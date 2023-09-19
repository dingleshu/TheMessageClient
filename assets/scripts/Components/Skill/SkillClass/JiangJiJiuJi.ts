import { PassiveSkill } from "../Skill";
import { Character } from "../../Chatacter/Character";
import { GameEventCenter, NetworkEventCenter } from "../../../Event/EventTarget";
import { GameEvent, NetworkEventToC } from "../../../Event/type";
import { GameData } from "../../../Manager/GameData";
import { GameLog } from "../../GameLog/GameLog";
import { Player } from "../../Player/Player";
import { skill_jiang_ji_jiu_ji_toc } from "../../../../protobuf/proto";

export class JiangJiJiuJi extends PassiveSkill {
  constructor(character: Character) {
    super({
      name: "将计就计",
      character,
      description: "你使用【误导】或成为【误导】的目标之一时，可以将此角色牌翻至面朝下。",
    });
  }

  init(gameData: GameData, player: Player) {
    NetworkEventCenter.on(
      NetworkEventToC.SKILL_JIANG_JI_JIU_JI_TOC,
      (data) => {
        this.onEffect(gameData, data);
      },
      this
    );
  }

  dispose() {
    NetworkEventCenter.off(NetworkEventToC.SKILL_ZHENG_DUO_TOC);
  }

  onEffect(gameData: GameData, { playerId }: skill_jiang_ji_jiu_ji_toc) {
    const gameLog = gameData.gameLog;
    const player = gameData.playerList[playerId];

    GameEventCenter.emit(GameEvent.PLAYER_USE_SKILL, {
      player,
      skill: this,
    });
    gameLog.addData(new GameLog(`${gameLog.formatPlayer(player)}使用技能【将计就计】`));
    GameEventCenter.emit(GameEvent.SKILL_HANDLE_FINISH, {
      player,
      skill: this,
    });
  }
}