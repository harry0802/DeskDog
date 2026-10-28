// Rig：把核心快照映射成 Part 的變換（ADR-0002），並做逐像素命中。
import { Container, Sprite } from "pixi.js";
import {
  FAST_DRAG_SPEED,
  LANDING_DURATION,
  type HitRegion,
  type Mood,
  type Motion,
  type PetSnapshot,
  type Point,
  type Rect,
} from "../../core/pet";
import { CANVAS, FEET, HEAD_TOP, isHeadPart, type Part } from "./parts";

/** Part alpha 超過 10% 才算命中。 */
const HIT_ALPHA = 255 * 0.1;
/** Greeting：原地小跳兩下。 */
const GREETING_DURATION = 700;
const GREETING_HOPS = 2;
const GREETING_HEIGHT = 18;
/** happy：每隔一段時間跳一下，尾巴快速擺動。 */
const HAPPY_HOP_PERIOD = 1600;
const HAPPY_HOP_DURATION = 320;
const HAPPY_HOP_HEIGHT = 14;
const HAPPY_WAG_PERIOD = 240;
const HAPPY_WAG_ANGLE = 0.35;
/** Pickup：身體抬起並輕微放大，驚訝時眼睛睜大、耳朵豎起。 */
const LIFT_HEIGHT = 10;
const LIFT_SCALE = 1.06;
/** 抬起與拉伸趨近目標的速率（1/s）。 */
const EASE_RATE = 14;
const SURPRISED_EYES = 1.5;
const PERKED_EARS = 1.2;
/** 依游標水平速度傾斜，上限約 13 度；以彈簧阻尼跟上。 */
const TILT_PER_SPEED = 0.00025;
const MAX_TILT = (13 * Math.PI) / 180;
const TILT_STIFFNESS = 120;
const TILT_DAMPING = 14;
/** 腿懸空下垂，以較軟的彈簧保持鉛直，產生鐘擺慣性。 */
const LEG_STIFFNESS = 40;
const LEG_DAMPING = 4;
const HANGING_LEGS = 1.08;
/** 快速拖拽：身體沿水平方向拉伸，耳朵與尾巴往反方向甩。 */
const STRETCH_X = 0.18;
const STRETCH_Y = 0.1;
const FLING_ANGLE = 0.6;
/** 下落時輕微往前轉。 */
const FALL_TILT = 0.15;
/** 落地壓扁的最大比例，LANDING_DURATION 內回彈。 */
const SQUASH_X = 1.2;
const SQUASH_Y = 0.75;

/** lonely：待機時趴下，頭與尾巴跟著放低；耳朵往後垂，尾巴慢慢擺。 */
const LYING_DROP = 40;
const DROOPING_EARS = 0.7;
const LONELY_WAG_PERIOD = 2400;
const LONELY_WAG_ANGLE = 0.12;

/** annoyed：左右腿輪流抬起跺地，身體跟著微微左右晃。 */
const STOMP_PERIOD = 360;
const STOMP_LIFT = 14;
const STOMP_SWAY = 4;

/** hmph：sulky 被哄時先回頭看一眼，再猛然轉開並抖一下。 */
const HMPH_DURATION = 900;
const HMPH_LOOK_END = 0.35;
const HMPH_SHAKE = 5;

/** 各 Mood 顯示的表情 Part；未列出的眼睛、嘴巴 Part 隱藏。 */
const EXPRESSIONS: Partial<Record<Mood, readonly string[]>> = {
  happy: ["eyes_happy", "mouth_happy"],
  annoyed: ["eyes_angry", "mouth_angry"],
  sulky: ["eyes_angry", "mouth_angry"],
};
const DEFAULT_EXPRESSION = ["eyes_open", "mouth_idle"];
const isExpression = (name: string) =>
  name.startsWith("eyes_") || name.startsWith("mouth_");
const isLeg = (name: string) => name.startsWith("leg_");
/** 趴下時跟著放低的 Part。 */
const isLowered = (name: string) => isHeadPart(name) || name === "tail";
const isEar = (name: string) => name.startsWith("ear_");
const isCarried = (motion: Motion) =>
  motion === "pickedUp" || motion === "dragging";

/** 半隱式 Euler 的阻尼彈簧。 */
class Spring {
  value = 0;
  private speed = 0;

  constructor(
    private readonly stiffness: number,
    private readonly damping: number
  ) {}

  step(target: number, dt: number): number {
    this.speed +=
      (this.stiffness * (target - this.value) - this.damping * this.speed) * dt;
    this.value += this.speed * dt;
    return this.value;
  }
}

interface RiggedPart {
  readonly part: Part;
  readonly sprite: Sprite;
}

export class Rig {
  readonly view = new Container();
  private readonly parts: RiggedPart[];
  private readonly tail: Sprite | undefined;
  private readonly eyes: Sprite | undefined;
  private readonly legs: Sprite[];
  private readonly ears: Sprite[];
  private base: Point = { x: 0, y: 0 };
  /** 1 為面向右（佔位 Part 的方向），-1 為面向左。 */
  private facing = -1;
  private mood: Mood = "normal";
  private lying = false;
  private motion: Motion = "idle";
  private velocity: Point = { x: 0, y: 0 };
  private elapsed = 0;
  private motionElapsed = 0;
  private greetingElapsed = GREETING_DURATION;
  private hmphElapsed = HMPH_DURATION;
  private snapshotFacing = -1;
  private lift = 0;
  private stretch = 0;
  private readonly tilt = new Spring(TILT_STIFFNESS, TILT_DAMPING);
  private readonly legSwing = new Spring(LEG_STIFFNESS, LEG_DAMPING);

  constructor(
    parts: readonly Part[],
    private readonly bounds: Rect
  ) {
    this.view.pivot.set(FEET.x, FEET.y);
    this.parts = parts.map((part) => {
      const sprite = new Sprite(part.texture);
      sprite.pivot.set(part.pivot.x, part.pivot.y);
      sprite.position.set(part.pivot.x, part.pivot.y);
      this.view.addChild(sprite);
      return { part, sprite };
    });
    const sprites = (match: (name: string) => boolean) =>
      this.parts.filter(({ part }) => match(part.name)).map((p) => p.sprite);
    this.tail = sprites((name) => name === "tail")[0];
    this.eyes = sprites((name) => name === "eyes_open")[0];
    this.legs = sprites(isLeg);
    this.ears = sprites(isEar);
    this.showExpression();
    this.showPose();
  }

  apply(snapshot: PetSnapshot): void {
    this.base = {
      x: snapshot.position.x - this.bounds.x,
      y: snapshot.position.y - this.bounds.y,
    };
    this.view.position.set(this.base.x, this.base.y);
    // 佔位 Part 面向右；面向左時水平翻轉。sulky 時背對使用者：轉向另一邊。
    this.snapshotFacing = snapshot.facing === "left" ? -1 : 1;
    this.facing = this.snapshotFacing * this.awayFactor();
    this.velocity = snapshot.velocity;
    if (snapshot.motion !== this.motion) {
      this.motion = snapshot.motion;
      this.motionElapsed = 0;
      this.showExpression();
      this.showPose();
    }
    if (snapshot.mood !== this.mood) {
      this.mood = snapshot.mood;
      this.showExpression();
      this.showPose();
    }
  }

  playGreeting(): void {
    this.greetingElapsed = 0;
  }

  playHmph(): void {
    this.hmphElapsed = 0;
  }

  /** sulky 背對使用者（-1）；hmph 的前段回頭看（1），之後轉開。 */
  private awayFactor(): number {
    if (this.mood !== "sulky") return 1;
    return this.hmphElapsed < HMPH_DURATION * HMPH_LOOK_END ? 1 : -1;
  }

  update(deltaMs: number): void {
    this.elapsed += deltaMs;
    this.motionElapsed += deltaMs;
    this.greetingElapsed = Math.min(
      GREETING_DURATION,
      this.greetingElapsed + deltaMs
    );
    this.hmphElapsed = Math.min(HMPH_DURATION, this.hmphElapsed + deltaMs);
    this.facing = this.snapshotFacing * this.awayFactor();
    const happy = this.mood === "happy";
    // 跳幀時（例如視窗暫停後）避免彈簧爆衝。
    const dt = Math.min(deltaMs, 50) / 1000;
    const carried = isCarried(this.motion);
    this.updateBody(dt, carried);

    const greetingPhase =
      (this.greetingElapsed / GREETING_DURATION) * GREETING_HOPS;
    const greetingHop =
      Math.abs(Math.sin(greetingPhase * Math.PI)) * GREETING_HEIGHT;
    const hopTime = this.elapsed % HAPPY_HOP_PERIOD;
    const happyHop =
      happy && hopTime < HAPPY_HOP_DURATION
        ? Math.sin((hopTime / HAPPY_HOP_DURATION) * Math.PI) * HAPPY_HOP_HEIGHT
        : 0;
    // 拖拽中不跳。
    const hop = carried ? 0 : Math.max(greetingHop, happyHop);
    const stomping = this.mood === "annoyed" && !carried;
    const stompPhase = (this.elapsed / STOMP_PERIOD) * Math.PI * 2;
    // 轉開之後抖一下，逐漸平息。
    const shakeAge = this.hmphElapsed / HMPH_DURATION - HMPH_LOOK_END;
    const shake =
      this.mood === "sulky" && shakeAge >= 0 && this.hmphElapsed < HMPH_DURATION
        ? Math.sin(shakeAge * 60) * HMPH_SHAKE * (1 - shakeAge)
        : 0;
    const sway = (stomping ? Math.sin(stompPhase) * STOMP_SWAY : 0) + shake;
    this.view.position.set(this.base.x + sway, this.base.y - hop - this.lift);

    // 腿保持鉛直：在翻轉的 Container 內，局部旋轉方向跟著翻轉。
    const legAngle =
      this.legSwing.step(carried ? -this.tilt.value : 0, dt) * this.facing;
    for (const leg of this.legs) {
      leg.rotation = legAngle;
      leg.scale.y = 1 + (HANGING_LEGS - 1) * (this.lift / LIFT_HEIGHT);
    }
    // 左腿與右腿反相：輪流抬起再踩下。
    for (const { part, sprite } of this.parts) {
      if (!isLeg(part.name)) continue;
      const side = part.name.endsWith("L") ? 1 : -1;
      const raise = stomping ? Math.max(0, Math.sin(stompPhase) * side) : 0;
      sprite.position.y = part.pivot.y - raise * STOMP_LIFT;
    }

    // 往前移動時耳朵與尾巴往後甩（局部座標中逆時針）。
    const forward = Math.sign(this.velocity.x) * this.facing;
    const fling = -forward * FLING_ANGLE * this.stretch;
    const surprised = this.motion === "pickedUp";
    const droop = this.mood === "lonely" ? -DROOPING_EARS : 0;
    for (const ear of this.ears) {
      ear.rotation = fling + droop;
      ear.scale.y = surprised ? PERKED_EARS : 1;
    }
    this.eyes?.scale.set(surprised ? SURPRISED_EYES : 1);

    if (this.tail) {
      const wag = happy
        ? Math.sin((this.elapsed / HAPPY_WAG_PERIOD) * Math.PI * 2) *
          HAPPY_WAG_ANGLE
        : this.mood === "lonely"
          ? Math.sin((this.elapsed / LONELY_WAG_PERIOD) * Math.PI * 2) *
            LONELY_WAG_ANGLE
          : 0;
      this.tail.rotation = wag + fling;
    }
  }

  /** 抬起、傾斜、拉伸與落地壓扁：整隻狗以腳底為基準的變換。 */
  private updateBody(dt: number, carried: boolean): void {
    const ease = Math.min(1, dt * EASE_RATE);
    this.lift += ((carried ? LIFT_HEIGHT : 0) - this.lift) * ease;
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    // 接近快速拖拽門檻時開始拉伸，達到門檻時拉到最滿。
    const stretchTarget = carried
      ? clamp((speed - FAST_DRAG_SPEED * 0.5) / (FAST_DRAG_SPEED * 0.5), 0, 1)
      : 0;
    this.stretch += (stretchTarget - this.stretch) * ease;

    const tiltTarget = carried
      ? clamp(this.velocity.x * TILT_PER_SPEED, -MAX_TILT, MAX_TILT)
      : this.motion === "falling"
        ? FALL_TILT * this.facing
        : 0;
    this.view.rotation = this.tilt.step(tiltTarget, dt);

    // 落地瞬間壓到最扁，之後 ease-out 回彈。
    const squash =
      this.motion === "landing"
        ? (1 - Math.min(1, this.motionElapsed / LANDING_DURATION)) ** 2
        : 0;
    const lifted = 1 + (LIFT_SCALE - 1) * (this.lift / LIFT_HEIGHT);
    const sx =
      lifted * (1 + STRETCH_X * this.stretch) * (1 + (SQUASH_X - 1) * squash);
    const sy =
      lifted * (1 - STRETCH_Y * this.stretch) * (1 - (1 - SQUASH_Y) * squash);
    this.view.scale.set(sx * this.facing, sy);
  }

  /** 狗狗畫布範圍（不含跳躍），覆蓋層視窗座標。 */
  footprint(): Rect {
    return {
      x: this.base.x - FEET.x,
      y: this.base.y - FEET.y,
      width: CANVAS.width,
      height: CANVAS.height,
    };
  }

  /** 頭頂位置（不含跳躍，趴下時跟著放低），覆蓋層視窗座標；Bubble 的錨點。 */
  headTop(): Point {
    return {
      x: this.base.x + (HEAD_TOP.x - FEET.x) * this.facing,
      y: this.base.y + (HEAD_TOP.y - FEET.y) + (this.lying ? LYING_DROP : 0),
    };
  }

  /** 游標命中的部位；point 為覆蓋層視窗座標。 */
  hitTest(point: Point): HitRegion {
    // 游標遠離時直接判定未命中。
    if (!this.view.getBounds().containsPoint(point.x, point.y)) return "none";
    // 由前往後找第一個命中的 Part，例如耳朵疊在身體前面時算頭部。
    const hit = [...this.parts].reverse().find(({ part, sprite }) => {
      if (!sprite.visible) return false;
      const local = sprite.toLocal(point);
      if (
        local.x < 0 ||
        local.y < 0 ||
        local.x >= CANVAS.width ||
        local.y >= CANVAS.height
      ) {
        return false;
      }
      const { data, width, height } = part.pixels;
      const px = Math.floor((local.x / CANVAS.width) * width);
      const py = Math.floor((local.y / CANVAS.height) * height);
      return (data[(py * width + px) * 4 + 3] ?? 0) > HIT_ALPHA;
    });
    if (!hit) return "none";
    return isHeadPart(hit.part.name) ? "head" : "body";
  }

  /** lonely 待機時趴下：換成趴姿身體、收起腿，頭與尾巴放低。 */
  private showPose(): void {
    const lying = this.mood === "lonely" && this.motion === "idle";
    this.lying = lying;
    for (const { part, sprite } of this.parts) {
      if (part.name === "body") sprite.visible = !lying;
      if (part.name === "body_lying") sprite.visible = lying;
      if (isLeg(part.name)) sprite.visible = !lying;
      if (isLowered(part.name)) {
        sprite.position.y = part.pivot.y + (lying ? LYING_DROP : 0);
      }
    }
  }

  private showExpression(): void {
    // 剛被抱起時一律是驚訝（睜大的眼睛），不論 Mood。
    const shown =
      this.motion === "pickedUp"
        ? DEFAULT_EXPRESSION
        : (EXPRESSIONS[this.mood] ?? DEFAULT_EXPRESSION);
    for (const { part, sprite } of this.parts) {
      if (isExpression(part.name)) sprite.visible = shown.includes(part.name);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
