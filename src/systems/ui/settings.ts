/**
 * 设置面板 —— 音量（主 / 音效 / 音乐）+ 静音 + 后期特效 + 画质档位。
 * 叠层场景：由菜单或暂停界面经 ui.pushOverlay('settings') 打开。
 *
 * 所有改动即时写入 core/settings（内部自动持久化 + 通知音频总线与视觉表），
 * 因此拖动滑块可实时听到音量变化、切换档位可立即看到特效变化。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { Button, Toggle, Slider, ui, UI_SCENE } from '../../core/uiComponent';
import type { UIScene, UIWidget } from '../../core/uiComponent';
import { Settings } from '../../core/settings';
import { sfx } from '../../core/audio';
import type { QualityTier } from '../../config/visuals';
import { tickLocal, drawMask, drawGlassPanel, drawTitle, makeBackButton, resetHover } from './primitives';
import { F } from './theme';

/** 场景动画计时 */
const _setTime = { t: 0, last: 0 };

const _ease = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** 画质档位说明表（按钮 + 描述文案同源，避免两处维护） */
const TIERS: { id: QualityTier; label: string; desc: string }[] = [
  { id: 'low', label: '低', desc: '低：关闭颗粒 / 扫描线 / 径向模糊，粒子减半' },
  { id: 'medium', label: '中', desc: '中：关闭色散与径向模糊，粒子八成' },
  { id: 'high', label: '高', desc: '高：全部特效开启' },
  { id: 'auto', label: '自动', desc: '自动：以高画质起步，掉帧时自动降级并自动恢复' },
];

interface SettingsActions {
  onBack: () => void;
}

/** 从任意界面打开设置面板（叠层；返回时自动回到来源场景） */
export function openSettings(): void {
  ui.pushOverlay(UI_SCENE.SETTINGS);
}

/** 构建设置场景 */
export function buildSettingsScene(a: SettingsActions): UIScene {
  const pw = 560, ph = 470;
  const px = VW / 2 - pw / 2;
  const py = VH / 2 - ph / 2;
  const rowX = px + 40;
  const rowW = pw - 80;

  // ── 音频 ──
  const sMaster = new Slider({
    id: 'set_master', label: '主音量', x: rowX, y: py + 96, w: rowW, h: 34,
    value: Settings.data.master, onChange: (v) => Settings.set({ master: v }),
  });
  const sSfx = new Slider({
    id: 'set_sfx', label: '音效音量', x: rowX, y: py + 136, w: rowW, h: 34,
    value: Settings.data.sfx, onChange: (v) => Settings.set({ sfx: v }),
  });
  const sBgm = new Slider({
    id: 'set_bgm', label: '音乐音量', x: rowX, y: py + 176, w: rowW, h: 34,
    value: Settings.data.bgm, onChange: (v) => Settings.set({ bgm: v }),
  });
  const tMute = new Toggle({
    id: 'set_mute', label: '静音（M 键）', checked: Settings.data.muted,
    x: rowX, y: py + 216, w: rowW, h: 34,
    onChange: (c) => Settings.set({ muted: c }),
  });

  // ── 画面 ──
  const tPost = new Toggle({
    id: 'set_postfx', label: '后期特效', checked: Settings.data.postfxOn,
    x: rowX, y: py + 276, w: rowW, h: 34,
    onChange: (c) => Settings.set({ postfxOn: c }),
  });

  /** 档位按钮：当前档位用 ✓ 前缀标记（Button 无选中态，用文案表达） */
  function syncTierButtons(): void {
    const cur = Settings.data.quality;
    TIERS.forEach((t, i) => {
      tierBtns[i].label = (t.id === cur ? '✓ ' : '') + t.label;
    });
  }

  const tierBtns = TIERS.map((t, i) => new Button({
    id: 'set_tier_' + t.id,
    label: t.label,
    variant: 'plain',
    x: rowX + i * 116,
    y: py + 322,
    w: 104,
    h: 40,
    onClick: () => {
      sfx.uiClick();
      Settings.set({ quality: t.id });
      syncTierButtons();
    },
  }));
  syncTierButtons();

  const btnBack = makeBackButton('set_back', () => {
    sfx.uiClick();
    a.onBack();
  }, { x: px + 24, y: py + 20 });

  const btnReset = new Button({
    id: 'set_reset',
    label: '恢复默认',
    variant: 'plain',
    x: px + pw - 150,
    y: py + ph - 68,
    w: 126,
    h: 38,
    onClick: () => {
      sfx.uiClick();
      Settings.set({
        master: 0.7, sfx: 0.9, bgm: 0.6,
        muted: false, quality: 'auto', postfxOn: true,
      });
      syncAll();
    },
  });

  /** 把组件的显示值同步回当前设置（重置 / 外部变更后用） */
  function syncAll(): void {
    sMaster.setValue(Settings.data.master);
    sSfx.setValue(Settings.data.sfx);
    sBgm.setValue(Settings.data.bgm);
    tMute.checked = Settings.data.muted;
    tPost.checked = Settings.data.postfxOn;
    syncTierButtons();
  }

  const widgets: UIWidget[] = [
    btnBack, sMaster, sSfx, sBgm, tMute, tPost, ...tierBtns, btnReset,
  ];

  /** 面板绘制（组件之下的装饰层） */
  function drawPanel(_t: number): void {
    const tt = tickLocal(_setTime);
    const en = _ease(tt / 0.28);
    if (en <= 0) return;

    ctx.save();
    ctx.globalAlpha = en;

    drawMask(0.72 * en);
    drawGlassPanel(px, py + (1 - en) * 24, pw, ph, 16, {
      shadowAlpha: 0.4, shadowBlur: 30,
      fill: 'rgba(10,8,32,.9)', stroke: 'rgba(130,160,255,.4)',
    });
    drawTitle('设置', py + 54 + (1 - en) * 24, 28);

    // 分区小标题
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '600 14px ' + F.UI;
    ctx.fillStyle = 'rgba(125,249,255,.75)';
    ctx.fillText('音频', rowX, py + 80 + (1 - en) * 24);
    ctx.fillText('画面', rowX, py + 260 + (1 - en) * 24);

    // 当前档位说明
    const cur = TIERS.find(t => t.id === Settings.data.quality);
    ctx.font = '500 13px ' + F.UI;
    ctx.fillStyle = 'rgba(170,195,255,.7)';
    ctx.fillText(cur ? cur.desc : '', rowX, py + 380 + (1 - en) * 24);

    // 底部提示
    ctx.fillStyle = 'rgba(150,175,235,.5)';
    ctx.fillText('设置自动保存在本机', rowX, py + ph - 46 + (1 - en) * 24);

    ctx.restore();
  }

  return {
    name: UI_SCENE.SETTINGS,
    widgets,
    draw: drawPanel,
    onEnter: () => {
      _setTime.t = 0;
      _setTime.last = 0;
      syncAll(); // 每次打开都以当前设置为准（如 M 键在别处改过静音）
    },
    onExit: () => {
      resetHover(...widgets);
    },
  };
}
