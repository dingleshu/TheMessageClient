import { CardStatus, CardUsage, CardOption, CardDirection, CardType, CardColor } from "./type";
import EventTarget from "../../Event/EventTarget";
import { GameEvent } from "../../Event/type";
import { DataClass } from "../DataClass";
import { CardUI } from "../../UI/Game/Card/CardUI";

export class Card extends DataClass {
  protected _id: number;
  protected _name: string;
  protected _type: CardType;
  protected _sprite: string;
  protected _status: CardStatus;
  protected _usage: CardUsage;
  protected _direction: CardDirection;
  protected _color: CardColor[];
  protected _lockable: boolean;
  protected _UI: CardUI;

  public readonly backSprite: string = "images/cards/CardBack";

  get id() {
    return this._id;
  }

  get name() {
    return this._name;
  }

  get type() {
    return this._type;
  }

  get sprite() {
    return this._sprite;
  }

  get status() {
    return this._status;
  }
  set status(status) {
    if (status !== this._status) {
      this._status = status;
      EventTarget.emit(GameEvent.CARD_STATUS_CHANGE, status);
    }
  }

  get usage() {
    return this._usage;
  }
  set usage(usage) {
    if (usage !== this._usage) {
      this._usage = usage;
      EventTarget.emit(GameEvent.CARD_USEAGE_CHANGE, usage);
    }
  }

  get direction() {
    return this._direction;
  }

  get color() {
    return this._color;
  }

  get lockable() {
    return this._lockable;
  }

  constructor(option: CardOption) {
    super(option.UI);
    this._id = option.id;
    this._name = option.name;
    this._sprite = option.sprite;
    this._type = option.type;
    this._status = option.status || CardStatus.FACE_UP;
    this._usage = option.usage || CardUsage.UNKNOWN;
    this._direction = option.direction;
    this._color = option.color;
    this._lockable = option.lockable;
  }

  //当做功能牌打出
  onPlay(...args: any[]): void {
    this.usage = CardUsage.FUNCTION_CARD;
  }

  //当做情报传递
  onSend(...args: any[]): void {
    this.usage = CardUsage.MESSAGE_CARD;
  }

  //翻面
  flip() {
    if (this.status === CardStatus.FACE_UP) {
      this.status = CardStatus.FACE_DOWN;
    } else {
      this.status = CardStatus.FACE_UP;
    }
  }

  bindUI(script: CardUI) {
    this._UI = script;
    this._UI.card = this;
  }
}

export class UnknownCard extends DataClass {
  public readonly status: CardStatus = CardStatus.FACE_DOWN;
  public readonly backSprite: string = "images/cards/CardBack";
  protected _UI: CardUI;

  constructor(UI?) {
    super(UI);
  }

  bindUI(script: CardUI) {
    this._UI = script;
    this._UI.card = this;
  }
}
