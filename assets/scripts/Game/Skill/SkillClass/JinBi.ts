import { ActiveSkill } from "../Skill";
import { Character } from "../../Character/Character";
import { skill_jin_bi_a_toc, skill_jin_bi_b_toc } from "../../../../protobuf/proto";
import { NetworkEventCenter, GameEventCenter, ProcessEventCenter } from "../../../Event/EventTarget";
import { NetworkEventToC, GameEvent, NetworkEventToS, ProcessEvent } from "../../../Event/type";
import { CardActionLocation, GamePhase, WaitingType } from "../../../GameManager/type";
import { GameData } from "../../../UI/Game/GameWindow/GameData";
import { GameLog } from "../../GameLog/GameLog";
import { Player } from "../../Player/Player";
import { GameUI } from "../../../UI/Game/GameWindow/GameUI";
import { getCardTypeCount } from "../../Card";

export class JinBi extends ActiveSkill {
  private usageCount: number = 0;

  get useable() {
    return this.usageCount === 0;
  }

  constructor(character: Character) {
    super({
      name: "禁闭",
      character,
      description:
        "出牌阶段限一次，你可以指定一名角色，除非其交给你两张手牌，否则其本回合不能使用手牌，且所有角色技能无效。",
      useablePhase: [GamePhase.MAIN_PHASE],
    });
  }

  init(gameData: GameData, player: Player) {
    NetworkEventCenter.on(
      NetworkEventToC.SKILL_JIN_BI_A_TOC,
      (data) => {
        this.onEffectA(gameData, data);
      },
      this
    );
    NetworkEventCenter.on(
      NetworkEventToC.SKILL_JIN_BI_B_TOC,
      (data) => {
        this.onEffectB(gameData, data);
      },
      this
    );
    GameEventCenter.on(GameEvent.MAIN_PHASE_END, this.resetUsageCount, this);
  }

  dispose() {
    NetworkEventCenter.off(NetworkEventToC.SKILL_JIN_BI_A_TOC);
    NetworkEventCenter.off(NetworkEventToC.SKILL_JIN_BI_B_TOC);
    GameEventCenter.off(GameEvent.MAIN_PHASE_END, this.resetUsageCount, this);
  }

  resetUsageCount() {
    this.usageCount = 0;
  }

  onUse(gui: GameUI) {
    const tooltip = gui.tooltip;

    tooltip.setText(`请选择一名角色`);
    gui.startSelectPlayer({
      num: 1,
      filter: (player: Player) => player.id !== 0,
    });

    tooltip.buttons.setButtons([
      {
        text: "确定",
        onclick: () => {
          NetworkEventCenter.emit(NetworkEventToS.SKILL_JIN_BI_A_TOS, {
            targetPlayerId: gui.selectedPlayers.list[0].id,
            seq: gui.seq,
          });
        },
        enabled: () => {
          return gui.selectedPlayers.list.length === 1;
        },
      },
      {
        text: "取消",
        onclick: () => {
          gui.promptUseHandCard("出牌阶段，请选择要使用的卡牌");
          this.gameObject.isOn = false;
        },
      },
    ]);
  }

  onEffectA(gameData: GameData, { playerId, targetPlayerId, waitingSecond, seq }: skill_jin_bi_a_toc) {
    GameEventCenter.emit(GameEvent.PLAYER_USE_SKILL, this);

    const gameLog = gameData.gameLog;
    const player = gameData.playerList[playerId];
    const targetPlayer = gameData.playerList[targetPlayerId];

    ProcessEventCenter.emit(ProcessEvent.START_COUNT_DOWN, {
      playerId: targetPlayerId,
      second: waitingSecond,
      type: WaitingType.HANDLE_SKILL,
      seq: seq,
    });

    if (targetPlayerId === 0) {
      GameEventCenter.emit(GameEvent.SKILL_ON_EFFECT, {
        skill: this,
        handler: "promptChooseHandCard",
        params: {
          player,
        },
      });
    }

    gameLog.addData(
      new GameLog(`${gameLog.formatPlayer(player)}使用技能【禁闭】,指定${gameLog.formatPlayer(targetPlayer)}`)
    );
  }

  promptChooseHandCard(gui: GameUI, params) {
    const { player } = params;
    const tooltip = gui.tooltip;
    const gameLog = gui.data.gameLog;

    tooltip.setText(`请选择两张手牌交给${gameLog.formatPlayer(player)}`);
    gui.startSelectHandCard({
      num: 2,
    });
    tooltip.buttons.setButtons([
      {
        text: "确定",
        onclick: () => {
          NetworkEventCenter.emit(NetworkEventToS.SKILL_JIN_BI_B_TOS, {
            cardIds: gui.selectedHandCards.list.map((card) => card.id),
            seq: gui.seq,
          });
        },
        enabled: () => gui.selectedHandCards.list.length === 2,
      },
      {
        text: "取消",
        onclick: () => {
          NetworkEventCenter.emit(NetworkEventToS.SKILL_JIN_BI_B_TOS, {
            cardIds: [],
            seq: gui.seq,
          });
        },
      },
    ]);
  }

  onEffectB(gameData: GameData, { playerId, targetPlayerId, cards, unknownCardCount }: skill_jin_bi_b_toc) {
    const gameLog = gameData.gameLog;
    const player = gameData.playerList[playerId];
    const targetPlayer = gameData.playerList[targetPlayerId];

    if (unknownCardCount === 0 && cards.length === 0) {
      if (targetPlayerId === 0) {
        gameData.cardBanned = true;
        gameData.skillBanned = true;
        gameData.bannedCardTypes = [...new Array(getCardTypeCount()).keys()];
        GameEventCenter.once(GameEvent.RECEIVE_PHASE_END, () => {
          gameData.cardBanned = false;
          gameData.skillBanned = false;
          gameData.bannedCardTypes = [];
          targetPlayer.gameObject.hideBannedIcon();
        });
      }
      targetPlayer.gameObject.showBannedIcon();
      GameEventCenter.once(GameEvent.RECEIVE_PHASE_END, () => {
        targetPlayer.gameObject.hideBannedIcon();
      });
      gameLog.addData(new GameLog(`${gameLog.formatPlayer(targetPlayer)}被【禁闭】`));
    } else {
      const handCards = gameData.playerRemoveHandCard(
        targetPlayer,
        unknownCardCount > 0 ? new Array(unknownCardCount).fill(0) : cards.map((card) => card)
      );
      gameData.playerAddHandCard(player, handCards);

      GameEventCenter.emit(GameEvent.CARD_ADD_TO_HAND_CARD, {
        player,
        card: handCards,
        from: { location: CardActionLocation.PLAYER_HAND_CARD, player: targetPlayer },
      });

      gameLog.addData(new GameLog(`${gameLog.formatPlayer(targetPlayer)}交给${gameLog.formatPlayer(player)}两张手牌`));
    }

    ++this.usageCount;
    GameEventCenter.emit(GameEvent.SKILL_HANDLE_FINISH, this);
  }
}
