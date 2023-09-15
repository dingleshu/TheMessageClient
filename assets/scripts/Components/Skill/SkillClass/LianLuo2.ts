import { TriggerSkill } from "../Skill";
import { Character } from "../../Chatacter/Character";
import { GameEvent, NetworkEventToC, NetworkEventToS } from "../../../Event/type";
import { GameEventCenter, NetworkEventCenter } from "../../../Event/EventTarget";
import { GameData } from "../../../Manager/GameData";
import { PlayerAction } from "../../../Utils/PlayerAction/PlayerAction";
import { PlayerActionStep } from "../../../Utils/PlayerAction/PlayerActionStep";
import { GameManager } from "../../../Manager/GameManager";
import { skill_lian_luo_toc } from "../../../../protobuf/proto";
import { GameLog } from "../../GameLog/GameLog";
import { Player } from "../../Player/Player";
import { PlayerActionStepName } from "../../../Utils/PlayerAction/type";
import { Card } from "../../Card/Card";
import { CardUsableStatus } from "../../Card/type";
import { CardActionLocation } from "../../../Manager/type";

export class LianLuo2 extends TriggerSkill {
  constructor(character: Character) {
    super({
      name: "联络",
      character,
      description: "你接收单色情报后，可以将一张与该情报颜色不同的手牌置入传出者的情报区，然后摸两张牌。",
    });
  }

  init(gameData: GameData, player: Player) {
    NetworkEventCenter.on(
      NetworkEventToC.SKILL_LIAN_LUO_TOC,
      (data) => {
        this.onEffect(gameData, data);
      },
      this
    );
  }

  dispose() {
    NetworkEventCenter.off(NetworkEventToC.SKILL_LIAN_LUO_TOC);
  }

  onTrigger(gui: GameManager, params): void {
    const tooltip = gui.tooltip;
    PlayerAction.addStep({
      step: new PlayerActionStep({
        handler: (data, { next, prev }) => {
          tooltip.setText(`你接收了单色情报，是否使用【联络】？`);
          tooltip.buttons.setButtons([
            {
              text: "确定",
              onclick: () => {
                next();
              },
            },
            {
              text: "取消",
              onclick: () => {
                prev();
              },
            },
          ]);
        },
      }),
    })
      .addStep({
        step: PlayerActionStepName.SELECT_HAND_CARDS,
        data: {
          filter: (card: Card) => {
            const messages = gui.data.selfPlayer.getMessagesCopy();
            const color = messages[messages.length - 1].color[0];
            if (Card.hasColor(card, color)) {
              return CardUsableStatus.UNUSABLE;
            } else {
              return CardUsableStatus.USABLE;
            }
          },
        },
      })
      .onComplete((data) => {
        NetworkEventCenter.emit(NetworkEventToS.SKILL_LIAN_LUO_TOS, {
          cardId: data[0].cards[0].id,
          seq: gui.seq,
        });
      })
      .onCancel(() => {
        NetworkEventCenter.emit(NetworkEventToS.END_RECEIVE_PHASE_TOS, {
          seq: gui.seq,
        });
      })
      .start();
  }

  onEffect(gameData: GameData, { playerId, targetPlayerId, card }: skill_lian_luo_toc) {
    const player = gameData.playerList[playerId];
    const targetPlayer = gameData.playerList[targetPlayerId];
    const gameLog = gameData.gameLog;

    GameEventCenter.emit(GameEvent.PLAYER_USE_SKILL, {
      player,
      skill: this,
    });

    const handCard = gameData.playerRemoveHandCard(player, card);
    targetPlayer.addMessage(handCard);
    GameEventCenter.emit(GameEvent.MESSAGE_PLACED_INTO_MESSAGE_ZONE, {
      player: targetPlayer,
      message: handCard,
      from: {
        location: CardActionLocation.PLAYER_HAND_CARD,
        player,
      },
    });

    gameLog.addData(new GameLog(`${gameLog.formatPlayer(player)}使用技能【联络】`));
    gameLog.addData(
      new GameLog(
        `${gameLog.formatPlayer(player)}将手牌${gameLog.formatCard(handCard)}置入${gameLog.formatPlayer(
          targetPlayer
        )}的情报区`
      )
    );

    GameEventCenter.emit(GameEvent.SKILL_HANDLE_FINISH, {
      player,
      skill: this,
    });
  }
}