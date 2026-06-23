/**
 * Character Preview Renderer - 캐릭터 전용 포트레이트 렌더링
 * 
 * 트랙/운동장 없이 캐릭터만 깔끔하게 렌더링하여 가이드용 이미지 생성
 * 400x400 캔버스, 단색 배경, PartsCharacter 직접 사용
 */

import { Application, Graphics } from 'pixi.js';
import { PartsCharacter } from './PartsCharacter';
import type { Palette } from '../../data/schema';
import type { TeamId } from '../../data/teams';

export class CharacterPreviewRenderer {
  private app: Application | null = null;
  private character: PartsCharacter | null = null;
  private container: HTMLElement;
  private canvas: HTMLCanvasElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init() {
    this.app = new Application();
    await this.app.init({
      width: 400,
      height: 400,
      backgroundAlpha: 0.95,
      antialias: true,
      resolution: window.devicePixelRatio || 1
    });

    // 배경 그리기 (연한 회색)
    const bg = new Graphics();
    bg.rect(0, 0, 400, 400);
    bg.fill({ color: 0xF0F0F0 });

    this.app.stage.addChild(bg);
    this.app.stage.sortableChildren = true;

    // 캔버스 마운트
    this.container.innerHTML = '';
    this.app.canvas.style.display = 'block';
    this.container.appendChild(this.app.canvas);
    this.canvas = this.app.canvas;
  }

  setCharacter(characterId: string, palette: Palette, runStyle: string, teamId?: TeamId) {
    // 기존 캐릭터 제거
    if (this.character) {
      this.character.destroy();
      this.character = null;
    }

    // 파츠 모델 가져오기 (동적 import)
    const model = (window as any).__partModels?.[characterId];
    if (!model) {
      console.warn(`Part model not found for ${characterId}`);
      return;
    }

    // 캐릭터 생성 (스케일 1.0 - 포트레이트용)
    this.character = new PartsCharacter(model, palette, runStyle, 1.0, teamId);

    // 중앙 정렬 (400x400 캔버스)
    this.character.root.position.set(200, 230);
    (this.character.root as any).anchor = { x: 0.5, y: 0.85 };

    if (this.app) {
      this.app.stage.addChild(this.character.root);
    }

    // Idle 포즈 (런 애니메이션 정지)
    this.updateCharacter('idle', 0);
  }

  updateCharacter(phase: 'idle' | 'running' | 'celebrate', speedNorm: number) {
    if (!this.character) return;

    this.character.update({
      phase,
      speedNorm,
      clock: 0,
      facing: 0,
      heading: 1,
      reducedMotion: true
    });
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  resize(width: number, height: number) {
    if (this.app) {
      this.app.renderer.resize(width, height);
    }
  }

  destroy() {
    if (this.character) {
      this.character.destroy();
      this.character = null;
    }
    if (this.app) {
      this.app.destroy();
      this.app = null;
    }
    this.canvas = null;
  }
}
