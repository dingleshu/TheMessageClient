import { ActiveSkill } from "../Skill";
import { Character } from "../../Chatacter/Character";
import { skill_xian_fa_zhi_ren_a_toc, skill_xian_fa_zhi_ren_b_toc } from "../../../../protobuf/proto";
import { GameEventCenter, NetworkEventCenter, ProcessEventCenter } from "../../../Event/EventTarget";
import { GameEvent, NetworkEventToC, NetworkEventToS, ProcessEvent } from "../../../Event/type";
import { GamePhase, WaitingType } from "../../../Manager/type";
import { GameData } from "../../../Manager/GameData";
import { GameLog } from "../../GameLog/GameLog";
import { Player } from "../../Player/Player";
import { GameManager } from "../../../Manager/GameManager";
import { CharacterStatus } from "../../Chatacter/type";

export class XianFaZhiRen extends ActiveSkill {
  constructor(character: Character) {
    super({
      name: "先发制人",
      character,
      description:
        "一张牌因角色技能置入情报区后，或争夺阶段，你可以翻开此角色牌，然后弃置一名角色情报区中的一张情报，并令一张角色牌本回合所有技能无效，若其是面朝下的隐藏角色牌，你可以将其翻开。",
      useablePhase: [GamePhase.FIGHT_PHASE],
    });
  }

  get useable() {
    return this.character.status === CharacterStatus.FACE_DOWN;
  }

  init(gameData: GameData, player: Player) {
    NetworkEventCenter.on(
      NetworkEventToC.WAIT_FOR_SKILL_XIAN_FA_ZHI_REN_A_TOC,
      (data) => {
        if (player.id === 0) {
          ProcessEventCenter.emit(ProcessEvent.START_COUNT_DOWN, {
            playerId: data.playerId,
            second: data.waitingSecond,
            type: WaitingType.USE_SKILL,
            seq: data.seq,
          });
        } else {
          gameData.playerList.forEach((player) => {
            if (player.id !== 0) {
              ProcessEventCenter.emit(ProcessEvent.START_COUNT_DOWN, {
                playerId: data.player.id,
                second: data.waitingSecond,
                isMultiply: true,
              });
            }
          });
        }
      },
      this
    );
    NetworkEventCenter.on(
      NetworkEventToC.SKILL_XIAN_FA_ZHI_REN_A_TOC,
      (data) => {
        this.onEffectA(gameData, data);
      },
      this
    );
    NetworkEventCenter.on(
      NetworkEventToC.SKILL_XIAN_FA_ZHI_REN_B_TOC,
      (data) => {
        this.onEffectB(gameData, data);
      },
      this
    );
  }

  dispose() {
    NetworkEventCenter.off(NetworkEventToC.WAIT_FOR_SKILL_XIAN_FA_ZHI_REN_A_TOC);
    NetworkEventCenter.off(NetworkEventToC.SKILL_XIAN_FA_ZHI_REN_A_TOC);
    NetworkEventCenter.off(NetworkEventToC.SKILL_XIAN_FA_ZHI_REN_B_TOC);
  }

  onUse(gui: GameManager) {
    const tooltip = gui.tooltip;
    const showCardsWindow = gui.showCardsWindow;

    let total = 0;
    for (let player of gui.data.playerList) {
      total += player.messageCounts.total;
    }

    if (total === 0) {
      tooltip.setText(`场上没有情报，不能使用【先发制人】`);
      return;
    }

    tooltip.setText(`请选择一名角色`);
    gui.gameLayer.startSelectPlayers({
      num: 1,
      filter: (player) => player.messageCounts.total > 0,
      onSelect: (player) => {
        showCardsWindow.show({
          title: "请选择一张情报弃置",
          limit: 1,
          cardList: player.getMessagesCopy(),
          buttons: [
            {
              text: "确定",
              onclick: () => {
                NetworkEventCenter.emit(NetworkEventToS.SKILL_XIAN_FA_ZHI_REN_A_TOS, {
                  enable: true,
                  targetPlayerId: player.id,
                  cardId: showCardsWindow.selectedCards.list[0].id,
                  seq: gui.seq,
                });
                showCardsWindow.hide();
              },
              enabled: () => showCardsWindow.selectedCards.list.length > 0,
            },
          ],
        });
      },
    });
  }

  onTrigger(gui: GameManager, params) {
    const tooltip = gui.tooltip;
    tooltip.setText(`是否使用【先发制人】？`);
    tooltip.buttons.setButtons([
      {
        text: "确定",
        onclick: () => {
          this.onUse(gui);
        },
      },
      {
        text: "取消",
        onclick: () => {
          NetworkEventCenter.emit(NetworkEventToS.SKILL_XIAN_FA_ZHI_REN_A_TOS, {
            enable: false,
            seq: gui.seq,
          });
        },
      },
    ]);
  }

  onEffectA(
    gameData: GameData,
    { enable, playerId, targetPlayerId, cardId, waitingSecond, seq }: skill_xian_fa_zhi_ren_a_toc
  ) {
    if (enable) {
      GameEventCenter.emit(GameEvent.PLAYER_USE_SKILL, this);
      const player = gameData.playerList[playerId];
      const targetPlayer = gameData.playerList[targetPlayerId];
      const gameLog = gameData.gameLog;

      const message = targetPlayer.removeMessage(cardId);
      
      GameEventCenter.emit(GameEvent.PLAYER_REMOVE_MESSAGE, { player: targetPlayer, messageList: [message] });

      gameLog.addData(new GameLog(`${gameLog.formatPlayer(player)}使用技能【先发制人】`));
      gameLog.addData(
        new GameLog(
          `${gameLog.formatPlayer(player)}弃置${gameLog.formatPlayer(targetPlayer)}的情报${gameLog.formatCard(message)}`
        )
      );

      ProcessEventCenter.emit(ProcessEvent.START_COUNT_DOWN, {
        playerId,
        second: waitingSecond,
        type: WaitingType.HANDLE_SKILL,
        seq: seq,
      });

      if (playerId === 0) {
        GameEventCenter.emit(GameEvent.SKILL_ON_EFFECT, {
          skill: this,
          handler: "promptChoosePlayer",
        });
      }
    }
  }

  promptChoosePlayer(gui: GameManager) {
    const tooltip = gui.tooltip;
    tooltip.setText("请选择一名角色");
    gui.gameLayer.startSelectPlayers({
      num: 1,
      onSelect: (player) => {
        if (player.character.status === CharacterStatus.FACE_DOWN) {
          tooltip.setText("是否将该角色翻开？");
          tooltip.buttons.setButtons([
            {
              text: "是",
              onclick: () => {
                NetworkEventCenter.emit(NetworkEventToS.SKILL_XIAN_FA_ZHI_REN_B_TOS, {
                  targetPlayerId: player.id,
                  faceUp: true,
                  seq: gui.seq,
                });
              },
            },
            {
              text: "否",
              onclick: () => {
                NetworkEventCenter.emit(NetworkEventToS.SKILL_XIAN_FA_ZHI_REN_B_TOS, {
                  targetPlayerId: player.id,
                  faceUp: false,
                  seq: gui.seq,
                });
              },
            },
          ]);
        } else {
          NetworkEventCenter.emit(NetworkEventToS.SKILL_XIAN_FA_ZHI_REN_B_TOS, {
            targetPlayerId: player.id,
            faceUp: false,
            seq: gui.seq,
          });
        }
      },
      onDeselect: () => {
        tooltip.setText("请选择一名角色");
        tooltip.buttons.setButtons([]);
      },
    });
  }

  onEffectB(gameData: GameData, { playerId, targetPlayerId, faceUp }: skill_xian_fa_zhi_ren_b_toc) {
    const gameLog = gameData.gameLog;
    const player = gameData.playerList[playerId];
    const targetPlayer = gameData.playerList[targetPlayerId];

    if (targetPlayerId === 0) {
      gameData.skillBanned = true;
      targetPlayer.gameObject.showBannedIcon();
      GameEventCenter.once(GameEvent.RECEIVE_PHASE_END, () => {
        gameData.skillBanned = false;
        targetPlayer.gameObject.hideBannedIcon();
      });
    }

    let str = `${gameLog.formatPlayer(player)}令${gameLog.formatPlayer(targetPlayer)}的技能无效`;
    if (faceUp) {
      str += "，并翻开该角色";
    }

    gameLog.addData(new GameLog(str));

    GameEventCenter.emit(GameEvent.SKILL_HANDLE_FINISH, this);
  }
}
