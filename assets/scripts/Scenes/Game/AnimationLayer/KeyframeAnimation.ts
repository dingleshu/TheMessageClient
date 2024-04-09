import { TweenEasing, Vec2, Vec3, Vec4, easing } from "cc";

interface AttributeVariationOption {
  /**
   * 需要修改的属性名称
   */
  attribute: string;
  /**
   * 开始时间，单位秒
   */
  startTime?: number;
  /**
   * 持续时间，单位秒
   */
  duration: number;
  /**
   * 缓动函数，可以使用内置缓动函数名称或自定义一个函数
   */
  easing?: TweenEasing | ((t: number) => number);
}

/**
 * 值为数字的动画选项
 */
export interface AttributeNumberVariationOption extends AttributeVariationOption {
  /**
   * 初始值，默认为当前值
   */
  from?: number;
  /**
   * 结束值
   */
  to: number;
}

/**
 * 值为向量的动画选项
 */
export interface AttributeVertexVariationOption extends AttributeVariationOption {
  /**
   * 初始值，默认为当前值
   */
  from?: Vec2 | Vec3 | Vec4;
  /**
   * 结束值
   */
  to: Vec2 | Vec3 | Vec4;
}

/**
 * 动画的添加方式
 */
type AnimationAction = "default" | "mix" | "replace" | "clear";
/**
 * 可以使用的动画事件
 */
type AnimationTrackEvent = "complete" | "cancel" | "pause" | "resume";

/**
 * 关键帧动画属性
 */
export class AttributeVariation {
  attribute: string;
  from: number | Vec2 | Vec3 | Vec4;
  to: number | Vec2 | Vec3 | Vec4;
  startTime: number;
  duration: number; //持续时间，单位毫秒
  easing?: (t: number) => number;

  constructor(option: AttributeNumberVariationOption | AttributeVertexVariationOption) {
    this.attribute = option.attribute;
    this.from = option.from || null;
    this.to = option.to;
    this.startTime = option.startTime * 1000 || 0;
    this.duration = option.duration * 1000;
    if (typeof option.easing === "function") {
      this.easing = option.easing;
    } else {
      this.easing = easing[option.easing];
    }
  }
}

/**
 * 关键帧动画类
 */
export class KeyframeAnimation {
  private _variations: AttributeVariation[] = [];
  private _duration: number = 0;

  get variations() {
    return this._variations;
  }
  get duration() {
    return this._duration;
  }

  constructor(variations?: AttributeVariation[]) {
    if (variations) {
      for (const variation of variations) {
        this.addVariation(variation);
      }
    }
  }

  /**
   * 向动画中添加一个属性AttributeVariation
   * @param variation AttributeVariation类
   */
  addVariation(variation: AttributeVariation) {
    const endTime = variation.startTime + variation.duration;
    if (this._duration < endTime) this._duration = endTime;
    this._variations.push(variation);
  }
}

/**
 * 绑定节点和动画
 */
class KeyframeAnimationTrack<T extends object> {
  private _target: T;
  private _animation: KeyframeAnimation;
  private _duration: number;
  private _startTime: number;
  private _pauseStartTime: number = 0;
  private _totalPausedTime: number = 0;
  private initialValues: any[] = [];
  private timeLine: { time: number; events: (() => void)[] }[] = [];
  private timeLineIndex: number = -1;
  private events: { [key in AnimationTrackEvent]?: (() => void)[] } = {};

  /**
   * 动画开始时间
   */
  get startTime() {
    return this._startTime;
  }

  /**
   * 动画结束时间
   */
  get endTime() {
    return this._startTime + this._duration;
  }

  /**
   * 动画绑定的对象
   */
  get target() {
    return this._target;
  }

  /**
   * 动画是否暂停
   */
  get paused() {
    return this._pauseStartTime !== 0;
  }

  constructor(target: T, animation: KeyframeAnimation, callbacks?: { [key in AnimationTrackEvent]?: () => void }) {
    this._target = target;
    this._animation = animation;
    this._duration = this._animation.duration;
    if (callbacks) {
      for (const eventName in callbacks) {
        this.on(<AnimationTrackEvent>eventName, callbacks[eventName]);
      }
    }
  }

  /**
   * 开始当前track，该方法由KeyframeAnimationManager类自动调用，请勿手动调用该方法。
   */
  start() {
    this._startTime = new Date().getTime();
    this.timeLineIndex = 0;
  }

  /**
   * 停止当前track，该方法由KeyframeAnimationManager类自动调用，请勿手动调用该方法。要停止该track请使用KeyframeAnimationManager.stopAnimation()
   * @param {boolean} [skip=true] 是否跳当前动画的剩余部分，直接跳到结束位置
   */
  stop(skip: boolean = true) {
    if (this.timeLineIndex < 0) return;
    if (skip) {
      for (let i = this.timeLineIndex; i < this.timeLine.length; i++) {
        for (const func of this.timeLine[i].events) {
          func();
        }
      }
      for (const variation of this._animation.variations) {
        this.setAttribute(variation, variation.to);
      }
    }
    this._startTime = 0;
    this.timeLineIndex = -1;
  }

  /**
   * 暂停当前track，如果track处于暂停状态，不进行任何操作。该方法由KeyframeAnimationManager类自动调用，请勿手动调用该方法。要暂停该track请使用KeyframeAnimationManager.pauseAnimation()
   */
  pause() {
    if (this._pauseStartTime === 0) {
      this._pauseStartTime = new Date().getTime();
    }
  }

  /**
   * 继续播放当前track，如果track未处于暂停状态，不进行任何操作。该方法由KeyframeAnimationManager类自动调用，请勿手动调用该方法。要暂停该track请使用KeyframeAnimationManager.resumeAnimation()
   */
  resume() {
    if (this._pauseStartTime !== 0) {
      this._totalPausedTime += new Date().getTime() - this._pauseStartTime;
      this._pauseStartTime = 0;
    }
  }

  /**
   * 注册一个动画事件
   * @param {number} time 触发事件的时间，从动画播放开始计算（单位：秒）
   * @param {Function} callback 回调函数
   * @returns 当前KeyframeAnimationTrack对象自身
   */
  on(time: number, callback: () => void): KeyframeAnimationTrack<T>;

  /**
   * 注册一个动画事件
   * @param {AnimationTrackEvent} eventName 事件名称
   * @param {Function} callback 回调函数
   * @returns 当前KeyframeAnimationTrack对象自身
   */
  on(eventName: AnimationTrackEvent, callback: () => void): KeyframeAnimationTrack<T>;
  on(event: number | AnimationTrackEvent, callback: () => void) {
    if (typeof event === "string") {
      if (!this.events[event]) this.events[event] = [];
      this.events[event].push(callback);
    } else {
      const time = event * 1000;
      if (this._duration < time) this._duration = time;
      if (this.timeLine.length === 0) {
        this.timeLine.push({ time, events: [callback] });
      } else {
        for (let i = this.timeLine.length - 1; i >= 0; i--) {
          const item = this.timeLine[i];
          if (time === item.time) {
            item.events.push(callback);
            break;
          } else if (time > item.time) {
            this.timeLine.splice(i + 1, 0, { time, events: [callback] });
            break;
          }
        }
      }
    }

    return this;
  }

  /**
   * 手动触发一个动画事件
   * @param eventName 要触发的事件名
   */
  trigger(eventName: AnimationTrackEvent) {
    if (this.events[eventName] && this.events[eventName].length > 0) {
      for (const func of this.events[eventName]) {
        func();
      }
    }
  }

  /**
   * 计算一帧的动画，该方法由KeyframeAnimationManager类自动调用，请勿手动调用该方法。
   * @param time 本帧的时间戳
   */
  apf(time: number) {
    if (!this._target) return false;
    time -= this._startTime + this._totalPausedTime;
    if (this.timeLineIndex < this.timeLine.length) {
      while (this.timeLine[this.timeLineIndex] && time >= this.timeLine[this.timeLineIndex].time) {
        for (const func of this.timeLine[this.timeLineIndex].events) {
          func();
        }
        ++this.timeLineIndex;
      }
    }
    if (time > this._duration) {
      this._animation.variations.forEach((variation) => {
        this.setAttribute(variation, variation.to);
      });
      return false;
    }
    this._animation.variations.forEach((variation, i) => {
      const t = time - variation.startTime;
      if (t < 0) return;
      if (this.initialValues[i] === undefined) {
        if (variation.from) {
          this.initialValues[i] = variation.from;
        } else {
          this.initialValues[i] = this.getAttribute(variation);
        }
      }
      const p =
        typeof variation.easing === "function" ? variation.easing(t / variation.duration) : t / variation.duration;
      //当前属性在执行时间范围内
      if (p < 1) {
        let val;
        if (typeof variation.to === "number") {
          val = (1 - p) * this.initialValues[i] + p * variation.to;
        } else {
          const from = (<Vec3>this.initialValues[i]).clone();
          const to = (<Vec3>variation.to).clone();
          val = from.multiplyScalar(1 - p).add(to.multiplyScalar(p));
        }
        this.setAttribute(variation, val);
      }
    });
    return true;
  }

  /**
   * 获取当前track的target对应属性的值
   * @param variation AttributeVariation对象
   * @returns 获取的值
   */
  private getAttribute(variation: AttributeVariation) {
    if (!this._target) return null;
    if (this._target[variation.attribute] !== undefined) {
      if (typeof this._target[variation.attribute] === "number") {
        return this._target[variation.attribute];
      } else {
        return this._target[variation.attribute].clone();
      }
    } else {
      const attrList = variation.attribute.split(".");
      if (attrList.length > 1) {
        const l = attrList.length - 1;
        let o = this._target;
        for (let i = 0; i < l; i++) {
          o = o[attrList[i]];
        }
        if (typeof o[attrList[l]] === "number") {
          return o[attrList[l]];
        } else {
          return o[attrList[l]].clone();
        }
      } else {
        return null;
      }
    }
  }

  /**
   * 设置当前track的target对应属性的值
   * @param variation AttributeVariation对象
   * @param val 值
   */
  private setAttribute(variation: AttributeVariation, val: number | Vec2 | Vec3 | Vec4) {
    if (!this._target) throw new Error("对象不存在");
    if (this._target[variation.attribute] !== undefined) {
      this._target[variation.attribute] = val;
    } else {
      const attrList = variation.attribute.split(".");
      if (attrList.length > 1) {
        const l = attrList.length - 1;
        let o = this._target;
        for (let i = 0; i < l; i++) {
          o = o[attrList[i]];
        }
        o[attrList[l]] = val;
      } else {
        throw new Error("对象没有该属性");
      }
    }
  }
}

/**
 * 管理所有KeyframeAnimation动画
 * @static
 */
export abstract class KeyframeAnimationManager {
  /**
   * 已经注册的动画
   */
  private static animations: { [index: string]: KeyframeAnimation } = {};
  /**
   * 未播放的动画队列
   */
  private static animationQueue = new Map<object, KeyframeAnimationTrack<object>[]>();
  /**
   * 正在播放的动画
   */
  private static activeAnimationMap = new Map<object, KeyframeAnimationTrack<object>[]>();

  /**
   * 把一个动画加入动画队列
   * @param track KeyframeAnimationTrack对象
   */
  private static enQueue(track: KeyframeAnimationTrack<object>) {
    if (!this.animationQueue.has(track.target)) {
      this.animationQueue.set(track.target, []);
    }
    const queue = this.animationQueue.get(track.target);
    queue.push(track);
  }

  /**
   * 取出一个target队列中的第一个动画
   * @param target 绑定了动画的对象
   * @returns 取出的KeyframeAnimationTrack类
   */
  private static deQueue(target: object) {
    if (!this.animationQueue.has(target)) {
      return null;
    }
    const queue = this.animationQueue.get(target);
    const track = queue.shift();
    if (queue.length === 0) {
      this.animationQueue.delete(target);
    }
    return track;
  }

  /**
   * 使用属性选项生成一个KeyframeAnimation动画并注册，如果名称已存在则会覆盖之前的动画
   * @param name 动画名称
   * @param variations 属性选项
   * @returns 生成的KeyframeAnimation对象
   */
  static createAnimation(
    name: string,
    variations: (AttributeNumberVariationOption | AttributeVertexVariationOption)[],
  ) {
    this.animations[name] = new KeyframeAnimation(variations.map((option) => new AttributeVariation(option)));
    return this.animations[name];
  }

  /**
   * 注册一个KeyframeAnimation动画，如果名称已存在则会覆盖之前的动画
   * @param name 动画名称
   * @param animation 一个KeyframeAnimation对象
   */
  static addAnimation(name: string, animation: KeyframeAnimation) {
    this.animations[name] = animation;
  }

  /**
   * 移除一个已注册的KeyframeAnimation动画
   * @param name 动画名称
   */
  static removeAnimation(name: string) {
    delete this.animations[name];
  }

  /**
   * 获取一个已注册的KeyframeAnimation动画
   * @param name 动画名称
   * @returns 获取的KeyframeAnimation动画
   */
  static getAnimation(name: string) {
    return this.animations[name];
  }

  /**
   * 播放一个KeyframeAnimation动画
   * @param {Object} option 动画选项
   * @param {object} option.target 执行动画的对象，必须是js的object类型
   * @param {KeyframeAnimation} option.animation KeyframeAnimation动画对象
   * @param {Function} [option.callbacks] 事件回调
   * @param {string} action 动画添加方式
   * @returns {KeyframeAnimationTrack} 返回根据传入参数生成的KeyframeAnimationTrack
   */
  static playAnimation(
    option: {
      target: object;
      targetModify?: (target: object) => object;
      animation: KeyframeAnimation;
      callbacks?: { [key in AnimationTrackEvent]?: () => void };
    },
    action?: AnimationAction,
  ): KeyframeAnimationTrack<typeof option.target>;

  /**
   * 创建并播放一个KeyframeAnimation动画
   * @param {Object} option 动画选项
   * @param {object} option.target 执行动画的对象，必须是js的object类型
   * @param {(AttributeNumberVariationOption | AttributeVertexVariationOption)[]} option.animation 动画关键帧数组
   * @param {Function} [option.callbacks] 事件回调
   * @param {string} action 动画添加方式
   * @returns 返回根据传入参数生成的KeyframeAnimationTrack
   */
  static playAnimation(
    option: {
      target: object;
      targetModify?: (target: object) => object;
      animation: (AttributeNumberVariationOption | AttributeVertexVariationOption)[];
      callbacks?: { [key in AnimationTrackEvent]?: () => void };
    },
    action?: AnimationAction,
  ): KeyframeAnimationTrack<typeof option.target>;

  /**
   * 播放一个已经注册过的动画
   * @param {Object} option 动画选项
   * @param {Object} option.target 执行动画的对象，必须是js的object类型
   * @param {string} option.animation 已经注册过的动画名称
   * @param {Function} [option.callbacks] 事件回调
   * @param {string} action 动画添加方式
   * @returns 返回根据传入参数生成的KeyframeAnimationTrack
   */
  static playAnimation(
    option: {
      target: object;
      targetModify?: (target: object) => object;
      animation: string;
      callbacks?: { [key in AnimationTrackEvent]?: () => void };
    },
    action?: AnimationAction,
  ): KeyframeAnimationTrack<typeof option.target>;
  static playAnimation(
    option: {
      target: object;
      targetModify?: (target: object) => object;
      animation: KeyframeAnimation | string | (AttributeNumberVariationOption | AttributeVertexVariationOption)[];
      callbacks?: { [key in AnimationTrackEvent]?: () => void };
    },
    action: AnimationAction = "default",
  ): KeyframeAnimationTrack<typeof option.target> {
    const { target, callbacks, targetModify } = option;
    let { animation } = option;
    if (!(typeof target === "object")) return null;
    if (typeof animation === "string") {
      animation = this.getAnimation(animation);
      if (!animation) return;
    } else if (animation instanceof Array) {
      animation = new KeyframeAnimation(animation.map((option) => new AttributeVariation(option)));
    }
    let track;
    const t = targetModify ? targetModify(target) : target;
    switch (action) {
      case "replace":
        track = new KeyframeAnimationTrack<typeof target>(t, animation, callbacks);
        this.activeAnimationMap.set(target, [track]);
        track.start();
        break;
      case "mix":
        track = new KeyframeAnimationTrack<typeof target>(t, animation, callbacks);
        if (this.activeAnimationMap.has(target)) {
          const tracks = this.activeAnimationMap.get(target);
          tracks.push(track);
        } else {
          this.activeAnimationMap.set(target, [track]);
        }
        track.start();
        break;
      case "clear":
        this.animationQueue.delete(track);
        track = new KeyframeAnimationTrack<typeof target>(t, animation, callbacks);
        this.activeAnimationMap.set(target, [track]);
        track.start();
        break;
      case "default":
      default:
        const list = this.activeAnimationMap.get(target);
        list && console.log([...list]);
        track = new KeyframeAnimationTrack<typeof target>(t, animation, callbacks);
        console.log(track);
        if (this.animationQueue.has(target) || this.activeAnimationMap.has(target)) {
          this.enQueue(track);
        } else {
          this.activeAnimationMap.set(target, [track]);
          track.start();
        }
    }

    return track;
  }

  /**
   * 结束一个KeyframeAnimation动画
   * @param {KeyframeAnimationTrack} track KeyframeAnimationTrack对象
   * @param {boolean} [skip=true] 是否跳当前动画的剩余部分，直接跳到结束位置
   */
  static stopAnimation(track: KeyframeAnimationTrack<object>, skip?: boolean): void;
  /**
   * 结束一个target所有正在播放的动画，继续播放队列中其他的动画
   * @param {Object} target 正在执行动画的target
   * @param {boolean} [skip=true] 是否跳当前动画的剩余部分，直接跳到结束位置
   */
  static stopAnimation(target: object, skip?: boolean): void;
  static stopAnimation(object: object | KeyframeAnimationTrack<object>, skip: boolean = true): void {
    if (object instanceof KeyframeAnimationTrack) {
      //删除一个track
      object.trigger("cancel");
      const target = object.target;
      object.stop(skip);
      const tracks = this.activeAnimationMap.get(target);
      if (!tracks) return;
      if (tracks.length > 1) {
        tracks.splice(tracks.indexOf(object), 1);
      } else {
        if (this.animationQueue.has(target)) {
          this.activeAnimationMap.set(target, [this.deQueue(target)]);
        } else {
          this.activeAnimationMap.delete(target);
        }
      }
    } else {
      //删除一个target对应的所有track
      const tracks = this.activeAnimationMap.get(object);
      if (tracks) {
        tracks.forEach((track) => {
          track.trigger("cancel");
        });
        if (this.animationQueue.has(object)) {
          this.activeAnimationMap.set(object, [this.deQueue(object)]);
        } else {
          this.activeAnimationMap.delete(object);
        }
      }
    }
  }

  /**
   * 暂停一个KeyframeAnimation动画
   * @param {KeyframeAnimationTrack} track KeyframeAnimationTrack对象
   */
  static pauseAnimation(track: KeyframeAnimationTrack<object>);
  /**
   * 暂停一个target所有正在播放的动画
   * @param {Object} target 正在执行动画的target
   */
  static pauseAnimation(target: object);
  static pauseAnimation(object: object | KeyframeAnimationTrack<object>) {
    if (object instanceof KeyframeAnimationTrack) {
      //暂停一个track
      object.pause();
      object.trigger("pause");
    } else if (this.animationQueue.has(object)) {
      //暂停一个target对应的所有track
      const tracks = this.activeAnimationMap.get(object);
      tracks.forEach((track) => {
        track.pause();
        track.trigger("pause");
      });
    }
  }

  /**
   * 继续一个KeyframeAnimation动画
   * @param {KeyframeAnimationTrack} track KeyframeAnimationTrack对象
   */
  static resumeAnimation(track: KeyframeAnimationTrack<object>);
  /**
   * 继续一个target所有正在播放的动画
   * @param {Object} target 正在执行动画的target
   */
  static resumeAnimation(target: object);
  static resumeAnimation(object: object | KeyframeAnimationTrack<object>) {
    if (object instanceof KeyframeAnimationTrack) {
      //继续一个track
      object.resume();
      object.trigger("resume");
    } else if (this.animationQueue.has(object)) {
      //继续一个target对应的所有track
      const tracks = this.activeAnimationMap.get(object);
      tracks.forEach((track) => {
        track.resume();
        track.trigger("resume");
      });
    }
  }

  /**
   * 每帧需要执行的动画
   */
  static apf() {
    const time = new Date().getTime();
    this.activeAnimationMap.forEach((tracks, target) => {
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (track.paused) continue;
        const isActive = track.apf(time);
        if (!isActive) {
          track.trigger("complete");
          tracks.splice(i, 1);
          --i;
        }
      }
    });
    this.activeAnimationMap.forEach((tracks, target) => {
      if (tracks.length === 0) {
        if (this.animationQueue.has(target)) {
          const track = this.deQueue(target);
          this.activeAnimationMap.set(target, [track]);
          track.start();
        } else {
          this.activeAnimationMap.delete(target);
        }
      }
    });
  }

  /**
   * 停止所有动画，清空动画队列，移除所有已注册的动画
   */
  static reset() {
    this.animations = {};
    this.animationQueue = new Map<object, KeyframeAnimationTrack<object>[]>();
    this.activeAnimationMap = new Map<object, KeyframeAnimationTrack<object>[]>();
  }
}
