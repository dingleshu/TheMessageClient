import { _decorator, Component, Node, RichText, Button, instantiate, Sprite, color } from "cc";
import { createCharacterById } from "../../../Game/Character";
import { Character } from "../../../Game/Character/Character";
import { CharacterStatus, CharacterType } from "../../../Game/Character/type";
import { Identity } from "../../../Game/Identity/Identity";
import { MysteriousPerson } from "../../../Game/Identity/IdentityClass/MysteriousPerson";
import { CharacterObject } from "../../../Game/Character/CharacterObject";
import { ProcessEventCenter ,NetworkEventCenter} from "../../../Event/EventTarget";
import { NetworkEventToS, ProcessEvent } from "../../../Event/type";
import { ProgressControl } from "../ProgressControl";

const { ccclass, property } = _decorator;

interface InitOption {
  identity: Identity;
  roles: CharacterType[];
  waitingSecond: number;
}

@ccclass("SelectCharacter")
export class SelectCharacter extends Component {
  @property(RichText)
  infoText: RichText | null = null;

  @property(Node)
  charcaterNode: Node | null = null;

  @property(Node)
  charcaterNodeList: Node | null = null;

  @property(Button)
  confirmButton: Button | null = null;

  private characterTypes: CharacterType[];
  private characterList: Character[] = [];
  private selectedCharacterIndex: number;

  init(data: InitOption) {
    //生成提示文字
    const { identity, roles, waitingSecond } = data;
    let text = `你的身份是：<color=${identity.color}>${identity.name}</color>`;
    if (identity instanceof MysteriousPerson) {
      text += `\n机密任务：${identity.secretTaskText}`;
    }
    this.infoText.getComponent(RichText).string = text;

    //生成角色
    this.characterTypes = roles;
    for (let i = 0; i < roles.length; i++) {
      const character = createCharacterById(roles[i]);
      character.status = CharacterStatus.FACE_UP;
      this.characterList.push(character);
      if (i === 0) {
        character.gameObject = this.charcaterNode.getChildByName("CharacterPanting").getComponent(CharacterObject);
      } else {
        const node = instantiate(this.charcaterNode);
        character.gameObject = node.getChildByName("CharacterPanting").getComponent(CharacterObject);
        this.charcaterNodeList.addChild(node);
      }
    }

    //给角色绑定点击事件
    for (let i = 0; i < this.charcaterNodeList.children.length; i++) {
      const node = this.charcaterNodeList.children[i];
      node.on(Node.EventType.TOUCH_END, (event) => {
        if (i === this.selectedCharacterIndex) {
          return;
        } else {
          this.selectedCharacterIndex = i;
        }
        //清除选择
        for (let i = 0; i < this.charcaterNodeList.children.length; i++) {
          const sprite = this.charcaterNodeList.children[i].getChildByName("CharacterBorder").getComponent(Sprite);
          sprite.color = color(0, 0, 0);
        }
        node.getChildByName("CharacterBorder").getComponent(Sprite).color = color(0, 255, 0);
      });
    }

    //按钮绑定点击事件
    this.confirmButton.node.on(Node.EventType.TOUCH_END, (event) => {
      this.confirmCharacter();
    });

    //显示窗口并开始倒计时
    this.show();

    //倒计时结束自动选择当前选中人物
    this.node
      .getChildByName("Progress")
      .getComponent(ProgressControl)
      .startCoundDown(waitingSecond, () => {
        this.confirmCharacter();
      });
  }

  show() {
    this.node.active = true;
    ProcessEventCenter.on(ProcessEvent.CONFORM_SELECT_CHARACTER, (data) => {
      let index = this.characterTypes.indexOf(data.role);
      for (let i = 0; i < this.charcaterNodeList.children.length; i++) {
        const node = this.charcaterNodeList.children[i];
        if (i !== index) {
          this.charcaterNodeList.removeChild(node);
          --i;
          --index;
        }
      }
      this.confirmButton.node.active = false;
    });
  }

  hide() {
    this.node.getChildByName("Progress").getComponent(ProgressControl).stopCountDown();
    ProcessEventCenter.off(ProcessEvent.CONFORM_SELECT_CHARACTER);
    this.node.active = false;
  }

  //倒计时进度条动画
  confirmCharacter() {
    if (this.selectedCharacterIndex == undefined) return;
    NetworkEventCenter.emit(NetworkEventToS.SELECT_ROLE_TOS, {
      role: this.characterTypes[this.selectedCharacterIndex],
    });
  }
}
