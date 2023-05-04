import { _decorator, Component, Node, Label, NodePool, Prefab, instantiate } from "cc";
import { ProgressControl } from "../UI/Game/ProgressControl";
import { TooltipText } from "./TooltipText";
import { GameEventCenter, ProcessEventCenter } from "../Event/EventTarget";
import { GameEvent, ProcessEvent } from "../Event/type";
import { GamePhase } from "./type";
const { ccclass, property } = _decorator;

interface ButtonConfig {
  text: string;
  onclick: () => void;
  disabled?: ((eventName: string, eventData: any) => boolean) | ((data: any) => boolean) | boolean;
}

@ccclass("Tooltip")
export class Tooltip extends Component {
  @property(Node)
  textNode: Node | null = null;
  @property(Node)
  buttons: Node | null = null;
  @property(Node)
  progressBar: Node | null = null;
  @property(Prefab)
  buttonPrefab: Prefab | null = null;

  private buttonPool = new NodePool();

  onEnable() {
    this.progressBar.active = false;
    this.hide();

    ProcessEventCenter.on(ProcessEvent.STOP_COUNT_DOWN, this.hide, this);
  }

  onDisable() {
    ProcessEventCenter.off(ProcessEvent.STOP_COUNT_DOWN, this.hide);
  }

  startCoundDown(second: number, callback?: Function) {
    this.progressBar.getComponent(ProgressControl).startCoundDown(second, callback);
    this.show();
  }

  setText(text: string) {
    this.textNode.getComponent(Label).string = text;
  }

  setTextByPhase(phase: GamePhase) {
    switch (phase) {
      case GamePhase.DRAW_PHASE:
        this.setText(TooltipText.SELF_DRAW_PHASE);
        break;
      case GamePhase.MAIN_PHASE:
        this.setText(TooltipText.SELF_MAIN_PHASE);
        break;
      case GamePhase.SEND_PHASE_START:
        this.setText(TooltipText.SELF_SEND_PHASE);
        break;
      case GamePhase.FIGHT_PHASE:
        this.setText(TooltipText.SELF_FIGHT_PHASE);
        break;
      case GamePhase.RECEIVE_PHASE:
        this.setText(TooltipText.SELF_RECEIVE_PHASE);
        break;
    }
  }

  show() {
    this.textNode.active = true;
    this.buttons.active = true;
  }

  hide() {
    this.textNode.active = false;
    this.buttons.active = false;
  }

  setButtons(buttons: ButtonConfig[]) {
    const l = buttons.length - this.buttons.children.length;
    if (l >= 0) {
      for (let i = 0; i < l; i++) {
        let button = this.buttonPool.get();
        if (!button) {
          button = instantiate(this.buttonPrefab);
        }
        this.buttons.addChild(button);
      }
    } else {
      for (let i = buttons.length; i < this.buttons.children.length; i++) {
        this.buttonPool.put(this.buttons.children[i]);
      }
    }
    for (let i = 0; i < buttons.length; i++) {
      const button = this.buttons.children[i];
      const config = buttons[i];
      button.getChildByName("Label").getComponent(Label).string = config.text;
      button.off(Node.EventType.TOUCH_END);
      button.on(Node.EventType.TOUCH_END, config.onclick, button);
    }
  }

  confirm(confirmText, cancelText) {
    return new Promise((reslove, reject) => {
      this.setButtons([
        {
          text: confirmText,
          onclick: () => {
            reslove(null);
          },
        },
        {
          text: cancelText,
          onclick: () => {
            reject(null);
          },
        },
      ]);
    });
  }
}
