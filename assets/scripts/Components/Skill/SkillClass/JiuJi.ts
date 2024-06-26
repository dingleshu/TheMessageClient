import { TriggerSkill } from "../../../Components/Skill/Skill";
import { Character } from "../../../Components/Character/Character";
import { skill_jiu_ji_a_toc, skill_jiu_ji_b_toc, skill_wait_for_jiu_ji_toc } from "../../../../protobuf/proto";
import { GameEventCenter, NetworkEventCenter, UIEventCenter } from "../../../Event/EventTarget";
import { GameEvent, NetworkEventToC, NetworkEventToS, UIEvent } from "../../../Event/type";
import { GameData } from "../../../Manager/GameData";
import { GameLog } from "../../../Components/GameLog/GameLog";
import { Player } from "../../../Components/Player/Player";
import { GameManager } from "../../../Manager/GameManager";
import { CardActionLocation, WaitingType } from "../../../Manager/type";

export class JiuJi extends TriggerSkill {
  constructor(character: Character) {
    super({
      name: "就计",
      character,
      description:
        "你被【试探】【威逼】或【利诱】指定为目标后，可以翻开此角色牌，然后摸两张牌，并在触发此技能的卡牌结算后，将其加入你的手牌。",
    });
  }

  init(gameData: GameData, player: Player) {
    NetworkEventCenter.on(
      NetworkEventToC.SKILL_JIU_JI_A_TOC,
      (data) => {
        this.onEffectA(gameData, data);
      },
      this,
    );
    NetworkEventCenter.on(
      NetworkEventToC.SKILL_JIU_JI_B_TOC,
      (data) => {
        this.onEffectB(gameData, data);
      },
      this,
    );
    NetworkEventCenter.on(
      NetworkEventToC.SKILL_WAIT_FOR_JIU_JI_TOC,
      ({ fromPlayerId, cardType, card, waitingSecond, seq }: skill_wait_for_jiu_ji_toc) => {
        UIEventCenter.emit(UIEvent.START_COUNT_DOWN, {
          playerId: 0,
          second: waitingSecond,
          type: WaitingType.USE_SKILL,
          seq,
          params: { skill: this, fromPlayerId, cardType, card },
        });
      },
      this,
    );
  }

  dispose() {
    NetworkEventCenter.off(NetworkEventToC.SKILL_JIU_JI_A_TOC);
    NetworkEventCenter.off(NetworkEventToC.SKILL_JIU_JI_B_TOC);
  }

  onTrigger(gui: GameManager, params): void {
    const { fromPlayerId, cardType, card } = params;
    const fromPlayer = gui.data.playerList[fromPlayerId];
    const tooltip = gui.tooltip;
    const gameLog = gui.gameLog;
    let cardPlayed;
    if (card) {
      cardPlayed = gui.data.createCard(card);
    } else {
      cardPlayed = gui.data.createCardByType(cardType);
    }

    tooltip.setText(
      `${gameLog.formatPlayer(fromPlayer)}对你使用${gameLog.formatCard(cardPlayed, false)}，是否使用【就计】`,
    );
    tooltip.buttons.setButtons([
      {
        text: "确定",
        onclick: () => {
          NetworkEventCenter.emit(NetworkEventToS.SKILL_JIU_JI_A_TOS, {
            enable: true,
            seq: gui.seq,
          });
        },
      },
      {
        text: "取消",
        onclick: () => {
          NetworkEventCenter.emit(NetworkEventToS.SKILL_JIU_JI_A_TOS, {
            enable: false,
            seq: gui.seq,
          });
        },
      },
    ]);
  }

  onEffectA(gameData: GameData, { playerId }: skill_jiu_ji_a_toc) {
    const player = gameData.playerList[playerId];

    GameEventCenter.emit(GameEvent.PLAYER_USE_SKILL, {
      player,
      skill: this,
    });
  }

  onEffectB(gameData: GameData, { playerId, card, unknownCardCount }: skill_jiu_ji_b_toc) {
    const player = gameData.playerList[playerId];
    const gameLog = gameData.gameLog;
    if (!card && unknownCardCount === 0) return;

    const cardOnPlay = gameData.createCard(card);
    gameData.cardOnPlay.entity.data = cardOnPlay;
    gameData.cardOnPlay = null;
    gameData.playerAddHandCard(player, cardOnPlay);

    GameEventCenter.emit(GameEvent.AFTER_PLAYER_PLAY_CARD, { card: cardOnPlay, flag: false });
    GameEventCenter.emit(GameEvent.CARD_ADD_TO_HAND_CARD, {
      player,
      card: cardOnPlay,
      from: { location: CardActionLocation.DISCARD_PILE },
    });

    gameLog.addData(new GameLog(`${gameLog.formatPlayer(player)}把${gameLog.formatCard(cardOnPlay)}加入手牌`));

    GameEventCenter.emit(GameEvent.SKILL_HANDLE_FINISH, {
      player,
      skill: this,
    });
  }
}
