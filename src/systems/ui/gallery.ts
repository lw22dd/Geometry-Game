/**
 * 预制体图鉴 —— 升级版：与 menu 同款氛围层 + 四角 HUD + 色差标题 + 错峰入场。
 * 操作：点击分类标签切换，翻页（超过 6 项时），返回按钮。
 */
import { ctx, VW, VH } from '../../core/canvas';
import { rr } from '../../core/math';
import { Button, UI_SCENE, ui } from '../../core/uiComponent';
import type { UIScene, UIWidget } from '../../core/uiComponent';
import { drawBackdrop, drawHUDFrame, drawNeonTitle, drawDecoStar, ease } from '../uiAtmosphere';
import { drawOrbIcon, drawJumpTicketIcon, drawHookIcon, drawShieldIcon, drawSpeedIcon, drawMagnetIcon } from './icons';
import { tickLocal, drawGlassPanel, makeBackButton, resetHover } from './primitives';

/* ==================== 图鉴状态（问题 3：开关由叠层栈承担，此处仅保留内容状态） ==================== */

export const gallery = { cat: 0, page: 0 };
export function openGallery(): void { gallery.cat = 0; gallery.page = 0; ui.pushOverlay('gallery'); }
export function closeGallery(): void { ui.popOverlay(); }

/* ---------- 本地计时（与 menu 同款独立时钟） ---------- */
const _gTime = { t: 0, last: 0 };

/* ==================== 图鉴数据 ==================== */

interface GalleryItem {
  id: string;
  name: string;
  draw: (cx: number, cy: number, t: number, r: number) => void;
}

/* 问题 9：分页 slice 缓存（键 = cat:page:length；页切换时重算） */
let _pageCacheKey = '';
let _pageCacheItems: GalleryItem[] = [];

interface GalleryCategory {
  id: string;
  icon: string;
  title: string;
  items: GalleryItem[];
}

/** 拾取物特效：bob 浮动 + 径向光晕 + 摇摆 + 图标本体（问题 13：四个道具共用一份样板） */
function drawPickup(
  cx: number, cy: number, t: number, r: number,
  glow: string, ph: number, dy: number, rotPh: number,
  icon: () => void,
): void {
  ctx.save();
  const bob = Math.sin(t * 1.5 + ph) * 0.06 * r;
  const cy2 = cy + bob;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, cy2, r * 0.2, cx, cy2, r * 2.4);
  g.addColorStop(0, glow);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy2, r * 2.4, 0, 6.283);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(cx, cy2 + r * dy);
  ctx.rotate(Math.sin(t * 2 + rotPh) * 0.18);
  icon();
  ctx.restore();
  ctx.restore();
}

const CATEGORIES: GalleryCategory[] = [
  {
    id: 'characters',
    icon: '',
    title: '角色',
    items: [
      {
        id: 'neon-runner',
        name: '霓虹跑者',
        draw: (cx, cy, t, r) => {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
          g.addColorStop(0, 'rgba(120,200,255,.35)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy, r * 2.5, 0, 6.283);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          ctx.shadowColor = 'rgba(120,200,255,.95)';
          ctx.shadowBlur = 14;
          const bg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
          bg.addColorStop(0, '#ffffff');
          bg.addColorStop(0.55, '#bfe9ff');
          bg.addColorStop(1, '#5f8dff');
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,.55)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283);
          ctx.stroke();
          const eyeR = r * 0.18;
          ctx.fillStyle = '#1a1440';
          for (const dx of [0.15, 0.55]) {
            ctx.beginPath();
            ctx.arc(cx + (dx - 0.35) * r * 1.5, cy - r * 0.15, eyeR, 0, 6.283);
            ctx.fill();
          }
          ctx.restore();
        },
      },
      {
        id: 'crimson-runner',
        name: '绯红冲刺者',
        draw: (cx, cy, t, r) => {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
          g.addColorStop(0, 'rgba(255,130,80,.38)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy, r * 2.5, 0, 6.283);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          ctx.shadowColor = 'rgba(255,100,60,.95)';
          ctx.shadowBlur = 14;
          const bg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
          bg.addColorStop(0, '#fff2ea');
          bg.addColorStop(0.55, '#ffb8a8');
          bg.addColorStop(1, '#ff4a3c');
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,170,140,.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283);
          ctx.stroke();
          const eyeR = r * 0.18;
          ctx.fillStyle = '#2b0d12';
          for (const dx of [0.15, 0.55]) {
            ctx.beginPath();
            ctx.arc(cx + (dx - 0.35) * r * 1.5, cy - r * 0.15, eyeR, 0, 6.283);
            ctx.fill();
          }
          ctx.restore();
        },
      },
    ],
  },
  {
    id: 'collectibles',
    icon: '',
    title: '收集品',
    items: [
      {
        id: 'orb',
        name: '光球',
        draw: (cx, cy, t, r) => drawOrbIcon(cx, cy, t, r),
      },
      {
        id: 'nova',
        name: 'NOVA 星',
        draw: (cx, cy, t, r) => {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createLinearGradient(0, cy, 0, cy - r * 3);
          g.addColorStop(0, 'rgba(190,140,255,.34)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(cx - r * 0.4, cy - r * 3, r * 0.8, r * 3);
          for (let i = 0; i < 2; i++) {
            const tt = ((t * 0.6 + i * 0.5) % 1), rr = tt * 3 * r;
            ctx.strokeStyle = 'rgba(210,160,255,' + ((1 - tt) * 0.45) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 6.283);
            ctx.stroke();
          }
          ctx.globalCompositeOperation = 'source-over';
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(t * 0.9);
          ctx.shadowColor = '#c07dff';
          ctx.shadowBlur = 18;
          ctx.fillStyle = '#f2e4ff';
          ctx.beginPath();
          ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0);
          ctx.closePath();
          ctx.fill();
          ctx.rotate(-t * 1.9);
          ctx.strokeStyle = '#e3ccff';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-r * 0.5, -r * 0.5, r, r);
          ctx.restore();
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 8;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(cx, cy, r * 0.16, 0, 6.283);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.restore();
        },
      },
      {
        id: 'jumpBoost',
        name: '双跳光球',
        draw: (cx, cy, t, r) => drawPickup(cx, cy, t, r, 'rgba(120,255,170,.28)', 0, 0.1, 0, () => drawJumpTicketIcon(0, 0, r)),
      },
      {
        id: 'hookPickup',
        name: '钩锁道具',
        draw: (cx, cy, t, r) => drawPickup(cx, cy, t, r, 'rgba(255,190,90,.30)', 0.7, 0.2, 0.4, () => drawHookIcon(0, 0, r)),
      },
      {
        id: 'shieldPickup',
        name: '护盾道具',
        draw: (cx, cy, t, r) => drawPickup(cx, cy, t, r, 'rgba(150,140,255,.32)', 1.1, 0.1, 1.2, () => drawShieldIcon(0, 0, r)),
      },
      {
        id: 'speedPickup',
        name: '加速道具',
        draw: (cx, cy, t, r) => drawPickup(cx, cy, t, r, 'rgba(140,246,255,.32)', 1.7, 0.1, 1.8, () => drawSpeedIcon(0, 0, r)),
      },
      {
        id: 'magnetPickup',
        name: '磁铁道具',
        draw: (cx, cy, t, r) => drawPickup(cx, cy, t, r, 'rgba(255,110,140,.32)', 2.3, 0.1, 2.4, () => drawMagnetIcon(0, 0, r)),
      },
      {
        id: 'checkpoint',
        name: '检查点',
        draw: (cx, cy, t, r) => {
          ctx.save();
          const bob = Math.sin(t * 1.5) * 0.06;
          const g = ctx.createLinearGradient(0, cy + bob, 0, cy - r * 3.2 + bob);
          g.addColorStop(0, 'rgba(125,249,255,.28)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(cx - r * 0.28, cy - r * 3.2 + bob, r * 0.56, r * 3.2);
          ctx.shadowColor = '#7df9ff';
          ctx.shadowBlur = 8;
          ctx.fillStyle = 'rgba(125,249,255,.9)';
          ctx.fillRect(cx - r * 0.9, cy + r * 0.15, r * 1.8, r * 0.3);
          ctx.shadowBlur = 0;
          ctx.restore();
        },
      },
    ],
  },
  {
    id: 'hazards',
    icon: '',
    title: '机关',
    items: [
      {
        id: 'laser',
        name: '激光栅栏',
        draw: (cx, cy, t, r) => {
          ctx.save();
          const on = Math.floor(t * 0.5) % 2 === 0;
          const y0 = cy - r * 2, y1 = cy + r * 2;
          const em = on ? '#ffffff' : '#ff8ad8';
          ctx.shadowColor = '#ff5fc8';
          ctx.shadowBlur = on ? 10 : 4;
          ctx.fillStyle = em;
          ctx.fillRect(cx - r * 0.3, y0 - r * 0.1, r * 0.6, r * 0.2);
          ctx.fillRect(cx - r * 0.3, y1 - r * 0.1, r * 0.6, r * 0.2);
          ctx.shadowBlur = 0;
          if (on) {
            const jx = Math.sin(t * 47) * 1.2;
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = 'rgba(255,140,220,.5)';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(cx + jx, y0); ctx.lineTo(cx + jx, y1);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,.95)';
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(cx + jx, y0); ctx.lineTo(cx + jx, y1);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
          } else {
            ctx.setLineDash([3, 5]);
            ctx.strokeStyle = 'rgba(255,110,200,.25)';
            ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(cx, y1);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          ctx.restore();
        },
      },
      {
        id: 'spike',
        name: '尖刺',
        draw: (cx, cy, t, r) => {
          ctx.save();
          ctx.shadowColor = 'rgba(255,110,220,.9)';
          ctx.shadowBlur = 8;
          ctx.fillStyle = 'rgba(30,12,50,.95)';
          ctx.strokeStyle = '#ff8ade';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(cx - r, cy + r);
          ctx.lineTo(cx + r, cy + r);
          ctx.lineTo(cx, cy - r);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.restore();
        },
      },
    {
        id: 'springPadV',
        name: '垂直弹簧',
        draw: (cx, cy, t, r) => {
          ctx.save();
          const w = r * 1.5, h = r * 0.8;
          const breath = 0.07 + 0.05 * Math.sin(t * 3.2) + 0.1;
          ctx.fillStyle = 'rgba(255,255,255,' + breath.toFixed(3) + ')';
          ctx.fillRect(cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 4);
          ctx.fillStyle = '#142210';
          ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
          ctx.strokeStyle = '#4aff8a';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = 'rgba(74,255,138,.8)';
          ctx.shadowBlur = 8;
          ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'hsla(145,100%,62%,.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i <= 8; i++) {
            const tt = i / 8;
            const y = cy - h / 2 + h * tt;
            const x = cx + (i % 2 === 0 ? -w * 0.22 : w * 0.22);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.fillStyle = 'hsla(145,100%,78%,.95)';
          ctx.fillRect(cx - w / 2, cy - h / 2, w, 2.5);
          ctx.restore();
        },
      },
      {
        id: 'springPadH',
        name: '水平弹簧',
        draw: (cx, cy, t, r) => {
          ctx.save();
          const h = r * 1.5, w = r * 0.8;
          ctx.fillStyle = '#142210';
          ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
          ctx.strokeStyle = '#4aff8a';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = 'rgba(74,255,138,.8)';
          ctx.shadowBlur = 8;
          ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'hsla(145,100%,62%,.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i <= 8; i++) {
            const tt = i / 8;
            const x = cx - w / 2 + w * tt;
            const y = cy + (i % 2 === 0 ? -h * 0.22 : h * 0.22);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.fillStyle = 'hsla(145,100%,78%,.95)';
          ctx.fillRect(cx + w / 2 - 2.5, cy - h / 2, 2.5, h);
          ctx.restore();
        },
      },
    ],
  },
  {
    id: 'platforms',
    icon: '',
    title: '平台',
    items: [
      {
        id: 'solid',
        name: '静态平台',
        draw: (cx, cy, t, r) => {
          ctx.save();
          ctx.fillStyle = 'rgba(15,11,42,.94)';
          ctx.fillRect(cx - r, cy - r * 0.6, r * 2, r * 1.2);
          ctx.shadowColor = 'rgba(120,170,255,.85)';
          ctx.shadowBlur = 10;
          ctx.strokeStyle = 'hsla(210,95%,66%,.9)';
          ctx.lineWidth = 1.6;
          ctx.strokeRect(cx - r, cy - r * 0.6, r * 2, r * 1.2);
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'hsla(210,100%,78%,.95)';
          ctx.fillRect(cx - r, cy - r * 0.6, r * 2, 2);
          ctx.restore();
        },
      },
      {
        id: 'mover',
        name: '移动平台',
        draw: (cx, cy, t, r) => {
          ctx.save();
          const dx = Math.sin(t * 1.3) * r * 0.6;
          ctx.setLineDash([2, 5]);
          ctx.strokeStyle = 'rgba(150,170,255,.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx - r * 0.8, cy);
          ctx.lineTo(cx + r * 0.8, cy);
          ctx.stroke();
          ctx.setLineDash([]);
          const px = cx + dx;
          ctx.fillStyle = 'rgba(20,14,52,.95)';
          ctx.fillRect(px - r, cy - r * 0.6, r * 2, r * 1.2);
          ctx.shadowColor = 'rgba(150,180,255,.9)';
          ctx.shadowBlur = 10;
          ctx.strokeStyle = 'hsla(220,100%,70%,.95)';
          ctx.lineWidth = 1.6;
          ctx.strokeRect(px - r, cy - r * 0.6, r * 2, r * 1.2);
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'hsla(220,100%,80%,.95)';
          ctx.fillRect(px - r, cy - r * 0.6, r * 2, 2);
          ctx.restore();
        },
      },
      {
        id: 'track',
        name: '玻璃管道',
        draw: (cx, cy, t, r) => {
          ctx.save();
          const hue = 190;
          const tubeW = r * 1.2;
          const r2 = tubeW / 2;
          const pts = [
            { x: cx - r * 2.2, y: cy },
            { x: cx - r * 0.8, y: cy },
            { x: cx, y: cy - r * 0.8 },
            { x: cx + r * 0.8, y: cy },
            { x: cx + r * 2.2, y: cy },
          ];
          ctx.shadowColor = `hsla(${hue},100%,60%,.85)`;
          ctx.shadowBlur = 10;
          ctx.strokeStyle = `hsla(${hue},100%,90%,.18)`;
          ctx.lineWidth = tubeW + 5;
          ctx.beginPath();
          for (let i = 0; i < pts.length; i++) {
            if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
            else ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = `hsla(${hue},85%,60%,.16)`;
          ctx.lineWidth = tubeW;
          ctx.beginPath();
          for (let i = 0; i < pts.length; i++) {
            if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
            else ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
          ctx.strokeStyle = `hsla(${hue},100%,92%,.6)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < pts.length; i++) {
            const ny = pts[i].y - (r2 - 1);
            if (i === 0) ctx.moveTo(pts[i].x, ny);
            else ctx.lineTo(pts[i].x, ny);
          }
          ctx.stroke();
          ctx.setLineDash([4, 6]);
          ctx.strokeStyle = `hsla(${hue},100%,80%,.3)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < pts.length; i++) {
            if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
            else ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          const breath = 0.1 + 0.08 * Math.sin(t * 2.5);
          ctx.fillStyle = `hsla(${hue},100%,70%,${breath.toFixed(3)})`;
          ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 4, 0, 6.283); ctx.fill();
          ctx.restore();
        },
      },
    ],
  },
  {
    id: 'decorations',
    icon: '',
    title: '装饰与提示',
    items: [
      {
        id: 'deco',
        name: '装饰方块',
        draw: (cx, cy, t, r) => {
          ctx.save();
          const s = r * 0.7;
          ctx.translate(cx, cy);
          ctx.rotate(t * 1.2);
          ctx.strokeStyle = 'rgba(170,140,255,.5)';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = 'rgba(170,140,255,.3)';
          ctx.shadowBlur = 6;
          ctx.strokeRect(-s, -s, s * 2, s * 2);
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(170,140,255,.12)';
          ctx.fillRect(-s, -s, s * 2, s * 2);
          ctx.restore();
        },
      },
      {
        id: 'hint',
        name: '提示文字',
        draw: (cx, cy, t, r) => {
          ctx.save();
          const bob = Math.sin(t * 1.8) * 3;
          ctx.fillStyle = 'rgba(255,215,0,.85)';
          ctx.shadowColor = 'rgba(255,215,0,.5)';
          ctx.shadowBlur = 6;
          ctx.font = `${Math.round(r * 0.45)}px "Segoe UI","Microsoft YaHei",Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('提示', cx, cy + bob);
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255,215,0,.2)';
          ctx.font = `${Math.round(r * 0.18)}px "Segoe UI","Microsoft YaHei",Arial`;
          ctx.fillText('点击交互', cx, cy + bob + r * 0.5);
          ctx.restore();
        },
      },
    ],
  },
  {
    id: 'fx',
    icon: '',
    title: '特效',
    items: [
      {
        id: 'death',
        name: '死亡爆裂',
        draw: (cx, cy, t, r) => {
          ctx.save();
          const n = 16;
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < n; i++) {
            const a = i / n * 6.283 + t * 0.5;
            const dist = (0.5 + 0.5 * Math.sin(t * 3 + i * 1.7)) * r * 1.2;
            const px = cx + Math.cos(a) * dist;
            const py = cy + Math.sin(a) * dist + t * 0.8 * r * 0.3;
            const size = 0.08 + 0.08 * Math.sin(t * 2 + i * 0.5);
            ctx.fillStyle = i % 2 === 0 ? '#7de8ff' : '#c77dff';
            ctx.fillRect(px - size * r, py - size * r, size * 2 * r, size * 2 * r);
          }
          ctx.restore();
        },
      },
      {
        id: 'dust',
        name: '落地尘土',
        draw: (cx, cy, t, r) => {
          ctx.save();
          const n = 6;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * 6.283 + t * 0.3;
            const dist = (0.3 + 0.3 * Math.sin(t * 2 + i * 1.2)) * r * 0.8;
            const px = cx + Math.cos(a) * dist;
            const py = cy + Math.sin(a) * dist - t * 0.6 * r * 0.3;
            ctx.fillStyle = 'rgba(159,184,255,' + (0.6 * (1 - (t * 0.5 % 1))) + ')';
            ctx.beginPath(); ctx.arc(px, py, r * 0.08, 0, 6.283);
            ctx.fill();
          }
          ctx.restore();
        },
      },
      {
        id: 'sparkle',
        name: '收集闪光',
        draw: (cx, cy, t, r) => {
          ctx.save();
          const n = 14;
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < n; i++) {
            const a = i / n * 6.283;
            const dist = r * 1.1;
            const px = cx + Math.cos(a) * dist;
            const py = cy + Math.sin(a) * dist;
            const alpha = 0.5 + 0.5 * Math.sin(t * 4 + i * 0.9);
            ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,' + alpha + ')' : 'rgba(143,246,255,' + alpha + ')';
            ctx.beginPath(); ctx.arc(px, py, r * 0.09, 0, 6.283);
            ctx.fill();
          }
          ctx.restore();
        },
      },
      {
        id: 'cp',
        name: '检查点光柱',
        draw: (cx, cy, t, r) => {
          ctx.save();
          const n = 10;
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < n; i++) {
            const ox = (Math.sin(i * 12.9898 + t * 0.1) * 0.5) * r * 0.7;
            const rise = (t * 1.6 + i * 0.13) % 1;
            const py = cy - rise * r * 2 - i * r * 0.05;
            const alpha = (1 - rise) * 0.7;
            ctx.fillStyle = 'rgba(125,249,255,' + alpha.toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(cx + ox, py, r * 0.08, 0, 6.283);
            ctx.fill();
          }
          ctx.restore();
        },
      },
      {
        id: 'confetti',
        name: '通关彩带',
        draw: (cx, cy, t, r) => {
          ctx.save();
          const n = 16;
          ctx.globalCompositeOperation = 'lighter';
          const colors = ['#7de8ff', '#c77dff', '#ff8ad8', '#ffffff'];
          for (let i = 0; i < n; i++) {
            const a = (i / n) * 6.283 + t * 0.3;
            const dist = (0.3 + 0.5 * (1 + Math.sin(t * 2 + i * 1.3))) * r * 0.9;
            const px = cx + Math.cos(a) * dist;
            const py = cy + Math.sin(a) * dist + t * 0.5 * r * 0.3;
            ctx.fillStyle = colors[i % colors.length];
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(t * 3 + i);
            ctx.fillRect(-r * 0.06, -r * 0.06, r * 0.12, r * 0.12);
            ctx.restore();
          }
          ctx.restore();
        },
      },
    {
        id: 'arrowBoost',
        name: '双跳增益环绕',
        draw: (cx, cy, t, r) => {
          ctx.save();
          const n = 6;
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < n; i++) {
            const a = (i / n) * 6.283 + t * 0.8;
            const dist = r * 0.9;
            const px = cx + Math.cos(a) * dist;
            const py = cy + Math.sin(a) * dist;
            const alpha = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.1);
            ctx.fillStyle = 'rgba(102,255,153,' + alpha.toFixed(3) + ')';
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(a + Math.PI / 2);
            const sz = r * 0.1;
            ctx.beginPath();
            ctx.moveTo(0, -sz * 2);
            ctx.lineTo(sz, sz);
            ctx.lineTo(0, sz * 0.3);
            ctx.lineTo(-sz, sz);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
        },
      },
      {
        id: 'doubleJump',
        name: '二段跳触发',
        draw: (cx, cy, t, r) => {
          ctx.save();
          const n = 8;
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < n; i++) {
            const a = (i / n) * 6.283 + t * 0.4;
            const dist = (0.3 + 0.3 * Math.sin(t * 2 + i * 1.2)) * r * 0.9;
            const px = cx + Math.cos(a) * dist;
            const py = cy + Math.sin(a) * dist - t * 0.6 * r * 0.3;
            const alpha = 0.6 * (1 - ((t * 0.5 + i * 0.08) % 1));
            ctx.fillStyle = 'rgba(102,255,153,' + alpha.toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(px, py, r * 0.08, 0, 6.283);
            ctx.fill();
          }
          ctx.restore();
        },
      },
    ],
  },
];

/* ==================== 场景构建 ==================== */

const ITEMS_PER_PAGE = 6;
const COLS = 3;
const ROWS = 2;

interface GalleryActions {
  onBack: () => void;
}

/** 分类标签 pill —— 自定义绘制（激活态高亮），带错峰入场 */
class TabPill implements UIWidget {
  readonly id: string;
  visible = true;
  hover = false;
  focusable = false;
  focused = false;
  onClick?: () => void;
  x: number;
  y: number;
  w: number;
  h: number;
  private icon: string;
  private title: string;
  private isActive: () => boolean;
  private enterDelay: number;

  constructor(id: string, icon: string, title: string, w: number, h: number, isActive: () => boolean, onClick: () => void, enterDelay = 0) {
    this.id = id;
    this.icon = icon;
    this.title = title;
    this.w = w;
    this.h = h;
    this.isActive = isActive;
    this.onClick = onClick;
    this.enterDelay = enterDelay;
    this.x = 0;
    this.y = 0;
  }

  hit(lx: number, ly: number): boolean {
    return lx >= this.x && lx <= this.x + this.w && ly >= this.y && ly <= this.y + this.h;
  }

  draw(t: number): void {
    const en = ease((t - this.enterDelay) / .35);
    if (en <= 0) return;
    const active = this.isActive();
    ctx.save();
    ctx.globalAlpha = en;
    ctx.translate(0, (1 - en) * 14);

    rr(ctx, this.x, this.y, this.w, this.h, 8);
    if (active) {
      ctx.shadowColor = 'rgba(140,200,255,.45)'; ctx.shadowBlur = 14;
      const g = ctx.createLinearGradient(0, this.y, 0, this.y + this.h);
      g.addColorStop(0, 'rgba(46,26,110,.9)'); g.addColorStop(1, 'rgba(22,12,60,.9)');
      ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(140,200,255,.75)'; ctx.lineWidth = 1.5; ctx.stroke();
    } else {
      ctx.fillStyle = this.hover ? 'rgba(30,20,70,.85)' : 'rgba(16,12,40,.65)'; ctx.fill();
      ctx.strokeStyle = this.hover ? 'rgba(140,200,255,.45)' : 'rgba(130,160,255,.22)';
      ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = active ? '700 16px "Segoe UI","Microsoft YaHei",Arial' : '500 16px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = active ? '#f2fbff' : (this.hover ? '#dff0ff' : '#9db0d0');
    const label = this.icon ? this.icon + ' ' + this.title : this.title;
    ctx.fillText(label, this.x + this.w / 2, this.y + this.h / 2 + 1);
    ctx.restore();
  }
}

/** 构建预制体图鉴场景 */
export function buildGalleryScene(a: GalleryActions): UIScene {
  const btnBack = makeBackButton('gallery_back', a.onBack);

  const tabBtns: TabPill[] = [];
  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i]; const idx = i;
    tabBtns.push(new TabPill(
      'gallery_tab_' + cat.id, cat.icon, cat.title, 180, 36,
      () => gallery.cat === idx,
      () => { gallery.cat = idx; gallery.page = 0; },
      0.25 + i * 0.07, // 错峰入场
    ));
  }

  const btnPrev = new Button({
    id: 'gallery_prev', label: '◀', variant: 'plain', x: 0, y: 0, w: 80, h: 34,
    onClick: () => { if (gallery.page > 0) gallery.page--; },
  });
  const btnNext = new Button({
    id: 'gallery_next', label: '▶', variant: 'plain', x: 0, y: 0, w: 80, h: 34,
    onClick: () => {
      const total = CATEGORIES[gallery.cat].items.length;
      const maxPage = Math.ceil(total / ITEMS_PER_PAGE) - 1;
      if (gallery.page < maxPage) gallery.page++;
    },
  });

  btnBack.onKey = (e: KeyboardEvent): boolean => {
    if (e.code === 'Escape') a.onBack();
    return true;
  };

  function layout(): void {
    const totalW = CATEGORIES.length * 180 + (CATEGORIES.length - 1) * 12;
    let x0 = (VW - totalW) / 2;
    for (let i = 0; i < tabBtns.length; i++) { tabBtns[i].x = x0; tabBtns[i].y = 84; x0 += 192; }
    btnPrev.x = VW / 2 - 90; btnPrev.y = 562;
    btnNext.x = VW / 2 + 10; btnNext.y = 562;
    const total = CATEGORIES[gallery.cat].items.length;
    const maxPage = Math.ceil(total / ITEMS_PER_PAGE) - 1;
    btnPrev.visible = gallery.page > 0;
    btnNext.visible = gallery.page < maxPage;
  }

  function drawPanel(_t: number): void {
    const t = tickLocal(_gTime);

    layout();

    // 1) 氛围层
    drawBackdrop(t);
    // 2) 四角 HUD
    drawHUDFrame(ease(t / .5));

    const cat = CATEGORIES[gallery.cat];
    const items = cat.items;
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    const page = Math.min(gallery.page, totalPages - 1);
    const startIdx = page * ITEMS_PER_PAGE;
    // 问题 9：分页 slice 缓存（仅页/分类/总数变化时重算，避免每帧 slice 分配）
    const pageCacheKey = gallery.cat + ':' + page + ':' + items.length;
    let pageItems: GalleryItem[];
    if (_pageCacheKey === pageCacheKey) {
      pageItems = _pageCacheItems;
    } else {
      _pageCacheKey = pageCacheKey;
      _pageCacheItems = items.slice(startIdx, startIdx + ITEMS_PER_PAGE);
      pageItems = _pageCacheItems;
    }

    ctx.save();

    // 3) 面板缩放入场
    const pe = ease(t / .45);
    const pw = 1130, ph = 600;
    const px = (VW - pw) / 2, py = 60 + (1 - pe) * 26;
    ctx.globalAlpha = pe;
    drawGlassPanel(px, py, pw, ph, 18, {
      shadowAlpha: 0.35, shadowBlur: 36, fill: 'rgba(10,8,34,.92)', stroke: 'rgba(130,160,255,.3)',
    });

    // 4) 色差标题 + 流光
    drawNeonTitle(VW / 2, 92, '预制体图鉴', 36, t, ease(t / .55));

    // 副标题 + 两侧装饰星
    ctx.font = '500 13px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = 'rgba(150,180,255,.6)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('· GALLERY · 预制体图鉴 ·', VW / 2, 120);
    drawDecoStar(VW / 2 - 100, 120, 5, t * .8, 'rgba(140,246,255,.7)', 1, ease((t - .3) / .4));
    drawDecoStar(VW / 2 + 100, 120, 5, -t * .8, 'rgba(255,160,220,.7)', 1, ease((t - .3) / .4));

    // 5) 卡片网格（错峰入场）
    const cardW = 340, cardH = 190, gapX = 24, gapY = 18;
    const gridW = COLS * cardW + (COLS - 1) * gapX;
    const gridX0 = (VW - gridW) / 2; const gridY0 = 148;

    for (let i = 0; i < pageItems.length; i++) {
      const item = pageItems[i];
      const col = i % COLS, row = Math.floor(i / COLS);
      const cx = gridX0 + col * (cardW + gapX) + cardW / 2;
      const cy = gridY0 + row * (cardH + gapY) + cardH / 2;
      const cardX = cx - cardW / 2, cardY = cy - cardH / 2;

      const ce = ease((t - 0.5 - i * 0.08) / 0.4);
      if (ce <= 0) continue;
      ctx.save();
      ctx.globalAlpha = pe * ce;
      ctx.translate(0, (1 - ce) * 18);

      ctx.shadowColor = 'rgba(80,60,200,.15)'; ctx.shadowBlur = 12;
      rr(ctx, cardX, cardY, cardW, cardH, 12);
      ctx.fillStyle = 'rgba(16,12,40,.5)'; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(130,160,255,.15)'; ctx.lineWidth = 1; ctx.stroke();
      const hg = ctx.createLinearGradient(0, cardY, 0, cardY + 16);
      hg.addColorStop(0, 'rgba(150,200,255,.08)'); hg.addColorStop(1, 'rgba(150,200,255,0)');
      rr(ctx, cardX + 2, cardY + 2, cardW - 4, 14, 10); ctx.fillStyle = hg; ctx.fill();

      item.draw(cx, cardY + 60, t, 40);

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 17px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = '#d0e8ff';
      ctx.fillText(item.name, cx, cardY + 120);

      ctx.strokeStyle = 'rgba(130,160,255,.08)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + 30, cardY + cardH - 8);
      ctx.lineTo(cardX + cardW - 30, cardY + cardH - 8);
      ctx.stroke();
      ctx.restore();
    }

    // 空白占位
    const emptyCount = ITEMS_PER_PAGE - pageItems.length;
    if (emptyCount > 0 && pageItems.length > 0) {
      const start = pageItems.length;
      for (let i = start; i < start + emptyCount; i++) {
        const col = i % COLS, row = Math.floor(i / COLS);
        const cx2 = gridX0 + col * (cardW + gapX) + cardW / 2;
        const cy2 = gridY0 + row * (cardH + gapY) + cardH / 2;
        ctx.save(); ctx.globalAlpha = 0.2;
        rr(ctx, cx2 - cardW / 2, cy2 - cardH / 2, cardW, cardH, 12);
        ctx.strokeStyle = 'rgba(130,160,255,.2)'; ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]); ctx.stroke(); ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // 页数指示
    if (totalPages > 1) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '500 14px "Segoe UI","Microsoft YaHei",Arial';
      ctx.fillStyle = 'rgba(160,180,255,.6)';
      ctx.fillText((page + 1) + ' / ' + totalPages, VW / 2, 555);
    }

    // 底部呼吸提示
    ctx.textAlign = 'center';
    ctx.font = '500 12px "Segoe UI","Microsoft YaHei",Arial';
    ctx.fillStyle = 'rgba(150,180,255,' + (.35 + .2 * Math.sin(t * 3.2)) + ')';
    ctx.fillText('点击分类标签切换 · 按 ESC 或「返回」关闭', VW / 2, 628);

    ctx.restore();
  }

  return {
    name: UI_SCENE.GALLERY,
    widgets: [btnBack, ...tabBtns, btnPrev, btnNext],
    draw: drawPanel,
    onEnter: () => { gallery.cat = 0; gallery.page = 0; _gTime.t = 0; _gTime.last = 0; },
    onExit: () => resetHover(btnBack, ...tabBtns, btnPrev, btnNext),
  };
}