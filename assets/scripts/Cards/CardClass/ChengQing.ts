import { Card } from "../Card";
import { CardClassDefaultOption, CardType } from "../types";

export default class CengQing extends Card {
  constructor(option: CardClassDefaultOption) {
    super({
      id: option.id,
      name: "澄清",
      type: CardType.CHENG_QING,
      spirit: "images/cards/CengQing.jpg",
      direction: option.direction,
    });
  }

  onPlay() {
    super.onPlay();
  }
}