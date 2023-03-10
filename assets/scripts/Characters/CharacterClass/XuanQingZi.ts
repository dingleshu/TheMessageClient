import { Character } from "../Character";
import { Sex, CharacterStatus } from "../type";
import { Skill } from "../../Skills/Skill";

export class XuanQingZi extends Character {
  constructor() {
    super({
      id: 16,
      name: "玄青子",
      sprite: "images/characters/XuanQingZi",
      status: CharacterStatus.FACE_UP,
      sex: Sex.MALE,
      skills: [] as Skill[],
    });
  }
}
