/**
 * WeaponVis —— 武器外观预制体（建模单一来源）。
 *
 * 集中所有武器绘制：AK 步枪 / 手雷 的本体建模与图标。
 * 调用方（拾取物 / 抛体 / 玩家持枪 / HUD / 图鉴）统一从这里取武器形状，
 * 不再各自散落一份武器绘制代码。
 *
 * API 分层：
 *  - drawAKShape / drawGrenadeShape：纯本体（在原点绘制，r 为尺度单位）；
 *    发光阴影由调用方控制（拾取物发光、图标自发光各异）。
 *  - drawAKIcon / drawGrenadeIcon / drawWeaponIcon：带发光阴影的图标
 *    （HUD 背包栏 / 持枪 / 抛体用）。
 *
 * 材质规范（与 Prefabs/Scenes/theme 的霓虹令牌同源思路）：
 *  ① 每个体素块 = 竖向渐变底 + 顶缘受光 + 底缘阴影 + 右缘暗边 → 通用厚度感；
 *  ② material 决定附加纹理：metal 拉丝 / wood 木纹 / polished 镜面 / rough 哑光；
 *  ③ 纹理按块体面积自动 LOD，小尺寸（HUD 图标）自动省略，不糊成一团。
 *
 * ⚠ 契约：drawAKShape 的参考坐标系（枪口朝右，x≈[2,39] / y≈[-11,4]）与
 *   `s = r * 0.09` + `translate(-20, 3)` 的映射**不得改动** —— 全部调用方
 *   （hold 持枪 / hud 背包 / icons 图鉴 / ItemVis 转发 / Scenes 拾取物 / combat 抛体）
 *   的尺寸与对齐都依赖这组常量。
 */
import { ctx } from '../../core/canvas';

/** 材质档：决定体素块的附加纹理 */
type Material = 'metal' | 'wood' | 'rough' | 'polished';

/**
 * 体素块：竖向渐变底 + 顶面受光 / 底面阴影 / 右缘暗 + 可选材质纹理。
 * @param material metal 拉丝 / wood 木纹 / polished 镜面 / rough 哑光（缺省）
 */
function voxelBlock(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, material?: Material): void {
  // ① 本体
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
  // ② 竖向渐变（上亮下暗 → 块体有厚度，而非平涂色块）
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(255,255,255,.10)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,.20)');
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  // ③ 顶缘受光 / 底缘阴影 / 右缘微暗（体积感三件套）
  c.fillStyle = 'rgba(255,255,255,.13)';
  c.fillRect(x, y, w, Math.min(h, 0.9));
  c.fillStyle = 'rgba(0,0,0,.20)';
  c.fillRect(x, y + h - 0.9, w, Math.min(h, 0.9));
  c.fillStyle = 'rgba(0,0,0,.10)';
  c.fillRect(x + w - 0.7, y, 0.7, h);
  // ④ 材质纹理（块体够大才画，避免小图标糊成一团）
  if (w >= 1.2 && h >= 1.5) {
    if (material === 'wood') {
      c.fillStyle = 'rgba(0,0,0,.10)';
      c.fillRect(x, y + h * 0.34, w, 0.6);
      c.fillRect(x, y + h * 0.62, w, 0.6);
      c.fillStyle = 'rgba(255,255,255,.06)';
      c.fillRect(x, y + h * 0.48, w, 0.4);
    } else if (material === 'metal') {
      c.fillStyle = 'rgba(255,255,255,.08)';
      c.fillRect(x + 0.3, y + h * 0.28, w - 0.6, 0.4);
      c.fillStyle = 'rgba(0,0,0,.08)';
      c.fillRect(x + 0.3, y + h * 0.58, w - 0.6, 0.4);
    } else if (material === 'polished') {
      c.fillStyle = 'rgba(255,255,255,.22)';
      c.fillRect(x + 0.3, y + h * 0.22, w - 0.6, Math.max(0.5, h * 0.2));
    }
  }
}

/**
 * AK 步枪本体（参考写实建模）。
 * 固定参考坐标系：枪口朝右，x 向右、y 向下为正，图形整体落在 x≈[2,39] / y≈[-11,4]；
 * 由 drawAKShape 经 scale/translate 映射为以 r 为尺度的原点绘制。
 */
function paintAK(c: CanvasRenderingContext2D): void {
  // ── 木枪托（梯形：贴腮近水平，下缘斜下，托端加高）──
  c.beginPath();
  c.moveTo(12, -7.2); c.lineTo(3.2, -6.4); c.lineTo(3.2, .6); c.lineTo(12, -3.2);
  c.closePath();
  c.fillStyle = '#6b4a2a'; c.fill();
  c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(3.6, -6.8, 8.2, .7);   // 顶缘受光
  c.fillStyle = 'rgba(0,0,0,.22)'; // 下缘阴影
  c.beginPath(); c.moveTo(12, -4.6); c.lineTo(3.2, -1.2); c.lineTo(3.2, .6); c.lineTo(12, -3.2); c.closePath(); c.fill();
  // 木纹层次（两深一浅，顺托身走向）
  c.fillStyle = 'rgba(0,0,0,.10)';
  c.fillRect(4.4, -5.2, 7.0, .5);
  c.fillRect(4.8, -3.4, 6.4, .5);
  c.fillStyle = 'rgba(255,255,255,.05)';
  c.fillRect(4.6, -4.3, 6.8, .4);
  // 托底板（金属）
  voxelBlock(c, 2.2, -6.8, 1.2, 7.6, '#3a3e46', 'metal');
  // 后枪带环（托身前端底部）
  c.strokeStyle = '#4a4e55';
  c.lineWidth = .8;
  c.beginPath(); c.arc(11.4, -3.6, 1.0, 0, 6.283); c.stroke();

  // ── 手枪握把（后倾）──
  c.save(); c.translate(13.4, -2.6); c.rotate(.32);
  voxelBlock(c, -1.1, -.6, 2.2, 5, '#23262c', 'rough');
  c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-1.1, -.6, .7, 4.4);
  c.restore();
  // ── 扳机护圈 + 扳机（握把前方，弹匣之后会被弹匣遮住后半）──
  c.strokeStyle = '#2a2d33';
  c.lineWidth = .9;
  c.beginPath();
  c.moveTo(13.8, -2.4); c.lineTo(17.2, -2.4);
  c.quadraticCurveTo(17.5, .3, 16.2, .3);
  c.lineTo(14.6, .3);
  c.quadraticCurveTo(13.6, .3, 13.8, -2.4);
  c.stroke();
  c.fillStyle = '#4a4e55'; // 扳机
  c.beginPath(); c.moveTo(15.4, -2.3); c.lineTo(16.3, -2.3); c.lineTo(15.9, -.5); c.closePath(); c.fill();

  // ── 香蕉弹匣：三段递进前弯（金属三色阶）──
  c.save(); c.translate(17.2, -2.6); c.rotate(-.18);
  voxelBlock(c, -2.2, -1, 4.4, 3.6, '#1c1e23', 'metal');
  c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(-.4, -.8, .6, 3.2);
  c.translate(0, 2.4); c.rotate(-.28);
  voxelBlock(c, -2.1, -1, 4.2, 3.6, '#1c1e23', 'metal');
  c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(-.4, -.8, .6, 3.2);
  c.translate(0, 2.4); c.rotate(-.3);
  voxelBlock(c, -2, -1, 4, 3.8, '#1c1e23', 'metal');
  c.fillStyle = '#3a3e46'; c.fillRect(-2.2, 2.2, 4.4, 1); // 匣底板
  c.restore();
  // 弹匣卡笋（匣口后方的拨片）
  voxelBlock(c, 19.9, -3.0, 1.7, .9, '#4a4e55', 'metal');

  // ── 机匣 ──
  voxelBlock(c, 12, -8.8, 10.5, 6.4, '#2a2d33', 'metal');
  // 机匣盖
  voxelBlock(c, 12, -9.6, 10.5, 2.4, '#3a3e46', 'metal');
  // 机匣盖加强筋（两道竖棱）
  c.fillStyle = 'rgba(255,255,255,.08)';
  c.fillRect(14.6, -9.4, .6, 2.0);
  c.fillRect(19.4, -9.4, .6, 2.0);
  // 铆钉
  c.fillStyle = '#4a4e55';
  c.beginPath(); c.arc(14.2, -7.2, .8, 0, 7); c.fill();
  c.beginPath(); c.arc(20.6, -7.2, .8, 0, 7); c.fill();
  // ── 枪机拉柄（机匣盖右侧，随枪机往复的突出件）──
  voxelBlock(c, 21.4, -8.0, 3.4, 1.1, '#3a3e46', 'polished');
  c.fillStyle = '#5b6069';
  c.beginPath(); c.arc(25.0, -7.45, .95, 0, 6.283); c.fill();
  c.fillStyle = 'rgba(255,255,255,.28)';
  c.beginPath(); c.arc(24.75, -7.7, .35, 0, 6.283); c.fill();
  // 抛壳窗
  voxelBlock(c, 18.6, -7.8, 2.2, 1.6, '#1c1e23', 'metal');
  // 快慢机/保险拨片（长拨杆+轴点）
  voxelBlock(c, 13.6, -6.2, 4.4, 1.1, '#4a4e55', 'metal');
  c.fillStyle = '#4a4e55'; c.beginPath(); c.arc(14, -5.6, .9, 0, 7); c.fill();
  // 表尺座（机匣盖与护木交界）
  voxelBlock(c, 21.3, -9.9, 1.4, 1.2, '#23262c', 'metal');
  // ── 木护木（真品表面光滑，无散热孔）──
  voxelBlock(c, 22.5, -5, 6, 3, '#6b4a2a', 'wood');
  // 护木后箍（金属包箍）
  voxelBlock(c, 22.3, -5.2, .9, 3.4, '#3a3e46', 'metal');
  // 导气管（护木上方）
  voxelBlock(c, 22.5, -6.8, 6, 1.7, '#3a3e46', 'metal');
  // 导气箍
  voxelBlock(c, 28.5, -7, 1.6, 3.4, '#23262c', 'metal');
  // 前枪带环（护木前端底部）
  c.strokeStyle = '#4a4e55';
  c.lineWidth = .8;
  c.beginPath(); c.arc(27.4, -2.1, 1.0, 0, 6.283); c.stroke();
  // ── 枪管（加长，外露段≈全枪 26%）──
  voxelBlock(c, 29.8, -6.1, 6.4, 1.7, '#2e3138', 'metal');
  // ── 准星（移至枪口附近）──
  voxelBlock(c, 34.6, -8.2, 1.8, 2.2, '#3a3e46', 'metal');          // 准星座
  c.fillStyle = '#23262c'; c.fillRect(35.2, -10.6, .8, 2.6); // 准星柱（高出顶线）
  c.fillRect(34.5, -9.4, .5, 1.4); c.fillRect(36.3, -9.4, .5, 1.4); // 护翼
  // ── 枪口制退器（斜切口多边形，开口朝前上）──
  c.beginPath();
  c.moveTo(36.4, -6.9); c.lineTo(38.6, -6.9); c.lineTo(37.8, -4.4); c.lineTo(36.4, -4.4);
  c.closePath();
  c.fillStyle = '#3a3e46'; c.fill();
  // 制退器体积：上缘受光 / 下缘阴影
  c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(36.4, -6.9, 2.2, .5);
  c.fillStyle = 'rgba(0,0,0,.24)'; c.fillRect(36.6, -4.9, 1.2, .5);
  c.fillStyle = '#23262c'; c.fillRect(36.4, -6.9, .7, 2.5); // 暗端
  // 枪口内壁（炮口黑洞，强化"能开火"的暗示）
  c.fillStyle = '#0e1013';
  c.fillRect(37.5, -6.6, 1.0, 2.1);
}

/** AK 步枪本体（原点绘制；枪口朝右，r 为尺度单位） */
function drawAKShape(r: number): void {
  ctx.save();
  const s = r * 0.09;
  ctx.scale(s, s);
  ctx.translate(-20, 3); // 将参考中心 (20,-3) 对齐到原点
  paintAK(ctx);
  ctx.restore();
}

/**
 * 短管霰弹枪本体建模（参考写实：截短双管 + 泵动护木 + 短木托）。
 * 固定参考坐标系与 AK 同源：枪口朝右，x 向右、y 向下为正，图形整体落在 x≈[2,39] / y≈[-11,4]；
 * 由 drawShotgunShape 经同一 scale/translate 映射（s = r*0.09 + translate(-20, 3)）。
 */
function paintShotgun(c: CanvasRenderingContext2D): void {
  // ── 短枪托（截短木托，贴腮近水平）──
  c.beginPath();
  c.moveTo(12, -7.0); c.lineTo(4.2, -6.0); c.lineTo(4.2, 1.2); c.lineTo(12, -2.6);
  c.closePath();
  c.fillStyle = '#6b4a2a'; c.fill();
  c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(4.8, -6.4, 7, .7);   // 顶缘受光
  c.fillStyle = 'rgba(0,0,0,.22)';
  c.beginPath(); c.moveTo(12, -4.2); c.lineTo(4.2, 0); c.lineTo(4.2, 1.2); c.lineTo(12, -2.6); c.closePath(); c.fill();
  // 托底板（金属）
  voxelBlock(c, 3.0, -6.4, 1.4, 7.6, '#3a3e46', 'metal');

  // ── 手枪握把（后倾短粗）──
  c.save(); c.translate(13.6, -2.6); c.rotate(.38);
  voxelBlock(c, -1.2, -.6, 2.4, 4.8, '#23262c', 'rough');
  c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-1.2, -.6, .8, 4.2);
  c.restore();
  // ── 扳机护圈 + 扳机 ──
  c.strokeStyle = '#2a2d33';
  c.lineWidth = .9;
  c.beginPath();
  c.moveTo(14.2, -2.5); c.lineTo(16.4, -2.5);
  c.quadraticCurveTo(17.4, 1.6, 15.6, 1.6);
  c.lineTo(13.8, 1.6);
  c.quadraticCurveTo(12.9, 1.6, 14.2, -2.5);
  c.stroke();
  c.fillStyle = '#4a4e55'; // 扳机
  c.beginPath(); c.moveTo(15.4, -2.5); c.lineTo(16.2, -2.5); c.lineTo(15.9, -.4); c.closePath(); c.fill();

  // ── 机匣（短粗方匣 + 抛壳窗）──
  voxelBlock(c, 12.6, -8.6, 10, 6.2, '#2a2d33', 'metal');
  voxelBlock(c, 12.6, -9.4, 10, 2.2, '#3a3e46', 'metal'); // 机匣盖
  voxelBlock(c, 17.6, -7.4, 2.2, 1.5, '#1c1e23', 'metal'); // 抛壳窗
  c.fillStyle = '#4a4e55';                                  // 铆钉
  c.beginPath(); c.arc(14.6, -7.4, .8, 0, 7); c.fill();
  c.beginPath(); c.arc(20.6, -7.4, .8, 0, 7); c.fill();

  // ── 泵动护木（管状粗木 + 前箍，霰弹特征件）──
  voxelBlock(c, 22.6, -3.0, 7.0, 3.4, '#6b4a2a', 'wood');
  voxelBlock(c, 22.4, -3.2, .9, 3.8, '#3a3e46', 'metal');

  // ── 截短双枪管（上下并排粗短管）──
  voxelBlock(c, 29.8, -8.0, 8.4, 3.4, '#2e3138', 'metal'); // 上管
  voxelBlock(c, 29.8, -0.6, 8.4, 3.4, '#2e3138', 'metal'); // 下管
  c.fillStyle = 'rgba(0,0,0,.30)'; c.fillRect(29.8, -4.8, 8.4, .6); // 管缝

  // ── 枪口箍 + 双炮口黑洞（短管大开口 = 霰弹识别度）──
  voxelBlock(c, 36.4, -8.4, 1.2, 4.2, '#3a3e46', 'metal');
  voxelBlock(c, 36.4, -1.0, 1.2, 4.2, '#3a3e46', 'metal');
  c.fillStyle = '#0e1013';
  c.fillRect(37.6, -7.8, 1.2, 3.0);
  c.fillRect(37.6, -0.4, 1.2, 3.0);

  // ── 低矮准星 ──
  voxelBlock(c, 33.4, -9.6, 1.3, 1.5, '#3a3e46', 'metal');
  c.fillStyle = '#23262c'; c.fillRect(34.0, -11.0, .7, 1.8);
}

/** 短管霰弹枪本体（原点绘制；枪口朝右，r 为尺度单位） —— 与 AK 共享同一坐标映射 */
function drawShotgunShape(r: number): void {
  ctx.save();
  const s = r * 0.09;
  ctx.scale(s, s);
  ctx.translate(-20, 3); // 将参考中心 (20,-3) 对齐到原点
  paintShotgun(ctx);
  ctx.restore();
}

/**
 * AWM 狙击步枪本体（简约几何风：细长枪管 + 大口径制退器 + 顶部瞄准镜）。
 * 固定参考坐标系与 AK 同源：枪口朝右，x≈[2,39] / y≈[-11,4]。
 */
function paintAWM(c: CanvasRenderingContext2D): void {
  // 枪托（后弯短托）
  c.fillStyle = '#3a3e46';
  c.beginPath();
  c.moveTo(12, -8.0); c.lineTo(3.5, -7.2); c.lineTo(3.2, -2.2); c.lineTo(12, -3.4);
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(4.0, -7.8, 7.4, .6);
  // 手枪握把
  c.save(); c.translate(13.8, -2.6); c.rotate(.45);
  voxelBlock(c, -1.0, -.5, 2.0, 4.2, '#23262c', 'rough');
  c.restore();
  // 机匣（细长）+ 抛壳窗
  voxelBlock(c, 12.4, -8.6, 12, 5.0, '#2a2d33', 'metal');
  voxelBlock(c, 12.4, -9.2, 12, 1.6, '#3a3e46', 'metal');
  voxelBlock(c, 18.0, -7.0, 2.0, 1.3, '#1c1e23', 'metal');
  // 顶部瞄准镜（细管 + 前后镜环）
  voxelBlock(c, 15.5, -11.4, 5.5, 1.5, '#1c1e23', 'polished');
  c.fillStyle = 'rgba(255,255,255,.25)';
  c.fillRect(16.0, -10.9, .9, .4);
  voxelBlock(c, 15.2, -11.9, .9, 2.5, '#4a4e55', 'metal');
  voxelBlock(c, 20.6, -11.9, .9, 2.5, '#4a4e55', 'metal');
  // 细长枪管（更长，外露 ≈34%）
  voxelBlock(c, 24.5, -6.9, 11, 1.6, '#2e3138', 'metal');
  // 枪口制退器（大口径矩形开口）
  voxelBlock(c, 35.6, -7.3, 3.2, 2.4, '#3a3e46', 'metal');
  c.fillStyle = '#0e1013';
  c.fillRect(38.2, -7.0, 1.0, 1.8);
}

/** AWM 狙击步枪本体（原点绘制；枪口朝右，r 为尺度单位） */
function drawAWMShape(r: number): void {
  ctx.save();
  const s = r * 0.09;
  ctx.scale(s, s);
  ctx.translate(-20, 3);
  paintAWM(ctx);
  ctx.restore();
}

/**
 * 火箭筒本体（简约几何风：粗管身 + 前端大口 + 尾翼）。
 * 固定参考坐标系与 AK 同源：枪口朝右，x≈[2,39] / y≈[-11,4]。
 */
function paintRocketLauncher(c: CanvasRenderingContext2D): void {
  // 管身（粗圆筒体素）
  voxelBlock(c, 10, -7.5, 22, 7.5, '#2e3138', 'metal');
  // 管身中部加强环
  voxelBlock(c, 19.5, -8.2, 1.6, 9.2, '#3a3e46', 'metal');
  // 前端（发射口加粗）+ 炮口黑洞
  voxelBlock(c, 32, -8.6, 6, 9.2, '#3a3e46', 'metal');
  c.fillStyle = '#0e1013';
  c.fillRect(36.4, -8.0, 1.8, 7.0);
  // 前端握把（管身下方小方块）
  voxelBlock(c, 30.5, -10.4, 1.4, 1.8, '#23262c', 'rough');
  // 瞄准基线（顶部细线）
  voxelBlock(c, 14, -9.6, 12, 1.0, '#23262c', 'metal');
  // 尾端（握把 + 肩托短块）
  voxelBlock(c, 5.5, -4.8, 4.5, 3.2, '#23262c', 'rough');
}

/** 火箭筒本体（原点绘制；枪口朝右，r 为尺度单位） */
function drawRocketShape(r: number): void {
  ctx.save();
  const s = r * 0.09;
  ctx.scale(s, s);
  ctx.translate(-20, 3);
  paintRocketLauncher(ctx);
  ctx.restore();
}

/**
 * 冰冻炸弹本体（简约几何风：冰蓝圆弹 + 引信座 + 拉环/冰晶）。
 * 以 r 为尺度的原点绘制；与手雷同布局（引信朝上）。
 */
function drawIceBombShape(r: number): void {
  const rx = r * 0.78;
  const ry = r * 0.86;
  const bodyCY = r * 0.06;

  // 冰蓝渐变弹体
  const g = ctx.createRadialGradient(-r * 0.30, bodyCY - r * 0.36, r * 0.08, 0, bodyCY, r * 1.05);
  g.addColorStop(0, '#bff3ff');
  g.addColorStop(0.45, '#5fceff');
  g.addColorStop(1, '#2a7fd6');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, bodyCY, rx, ry, 0, 0, 6.283); ctx.fill();
  // 冰裂纹（纵横短线，浅白）
  ctx.strokeStyle = 'rgba(235,252,255,.85)';
  ctx.lineWidth = Math.max(0.5, r * 0.035);
  ctx.beginPath();
  ctx.moveTo(-rx * 0.5, bodyCY - ry * 0.2); ctx.lineTo(-rx * 0.1, bodyCY + ry * 0.45);
  ctx.moveTo(rx * 0.15, bodyCY - ry * 0.55); ctx.lineTo(rx * 0.5, bodyCY - ry * 0.05);
  ctx.moveTo(-rx * 0.2, bodyCY - ry * 0.6); ctx.lineTo(-rx * 0.45, bodyCY - ry * 0.1);
  ctx.stroke();
  // 引信座（金属短柱）
  const fuzeW = r * 0.40;
  const fuzeTop = bodyCY - ry - r * 0.30;
  const fg = ctx.createLinearGradient(-fuzeW / 2, 0, fuzeW / 2, 0);
  fg.addColorStop(0, '#5a5f68');
  fg.addColorStop(0.35, '#9aa0aa');
  fg.addColorStop(1, '#3c4149');
  ctx.fillStyle = fg;
  ctx.fillRect(-fuzeW / 2, fuzeTop, fuzeW, r * 0.30);
  // 拉环 + 冰晶尖刺（顶部小三角）
  ctx.strokeStyle = '#dff6ff';
  ctx.lineWidth = Math.max(0.8, r * 0.08);
  ctx.beginPath(); ctx.arc(r * 0.16, fuzeTop - r * 0.16, r * 0.16, 0, 6.283); ctx.stroke();
  // 弹体高光
  ctx.fillStyle = 'rgba(235,252,255,.6)';
  ctx.beginPath(); ctx.ellipse(-rx * 0.34, bodyCY - ry * 0.40, r * 0.2, r * 0.13, -0.5, 0, 6.283); ctx.fill();
}

/**
 * 手雷本体（原点绘制；引信朝上，r 为尺度单位）。
 * 分层：卵形铸造弹体（径向受光 + 菠萝分段纹 + 右下环境反光 + 左上镜面高光）
 *       → 螺纹引信座 → 保险握片（右侧杠杆）→ 拉环 + 开口销。
 */
function drawGrenadeShape(r: number): void {
  const bodyCY = r * 0.06;
  const rx = r * 0.78;
  const ry = r * 0.86;

  // ① 弹体（卵形；略高略窄，比正圆更有"铸造弹体"感）
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, bodyCY, rx, ry, 0, 0, 6.283);
  ctx.clip();
  const g = ctx.createRadialGradient(-r * 0.30, bodyCY - r * 0.36, r * 0.08, 0, bodyCY, r * 1.05);
  g.addColorStop(0, '#8ac47c');
  g.addColorStop(0.45, '#4c7a44');
  g.addColorStop(1, '#25401f');
  ctx.fillStyle = g;
  ctx.fillRect(-rx, bodyCY - ry, rx * 2, ry * 2);
  // 铸造分段纹（横 2 + 竖 3 = 经典菠萝纹）
  ctx.strokeStyle = 'rgba(16,30,14,.55)';
  ctx.lineWidth = Math.max(0.6, r * 0.075);
  for (let i = 1; i <= 2; i++) {
    const y = bodyCY - ry + (ry * 2 * i) / 3;
    ctx.beginPath(); ctx.moveTo(-rx, y); ctx.lineTo(rx, y); ctx.stroke();
  }
  for (let i = 1; i <= 3; i++) {
    const x = -rx + (rx * 2 * i) / 4;
    ctx.beginPath(); ctx.moveTo(x, bodyCY - ry); ctx.lineTo(x, bodyCY + ry); ctx.stroke();
  }
  ctx.restore();

  // ② 弹体轮廓 + 右下缘环境反光（冷色轮廓光，与霓虹场景呼应）
  ctx.strokeStyle = 'rgba(12,24,10,.75)';
  ctx.lineWidth = Math.max(0.7, r * 0.06);
  ctx.beginPath(); ctx.ellipse(0, bodyCY, rx, ry, 0, 0, 6.283); ctx.stroke();
  ctx.strokeStyle = 'rgba(190,225,180,.35)';
  ctx.lineWidth = Math.max(0.6, r * 0.05);
  ctx.beginPath(); ctx.ellipse(0, bodyCY, rx, ry, 0, Math.PI * 0.15, Math.PI * 0.72); ctx.stroke();
  // ③ 左上镜面高光
  ctx.fillStyle = 'rgba(228,255,216,.5)';
  ctx.beginPath(); ctx.ellipse(-rx * 0.34, bodyCY - ry * 0.40, r * 0.20, r * 0.13, -0.5, 0, 6.283); ctx.fill();

  // ④ 引信座（螺纹金属圆柱）
  const fuzeW = r * 0.40;
  const fuzeTop = bodyCY - ry - r * 0.30;
  const fuzeH = r * 0.32;
  const fg = ctx.createLinearGradient(-fuzeW / 2, 0, fuzeW / 2, 0);
  fg.addColorStop(0, '#5a5f68');
  fg.addColorStop(0.35, '#9aa0aa');
  fg.addColorStop(1, '#3c4149');
  ctx.fillStyle = fg;
  ctx.fillRect(-fuzeW / 2, fuzeTop, fuzeW, fuzeH);
  ctx.strokeStyle = 'rgba(20,24,28,.6)';
  ctx.lineWidth = Math.max(0.5, r * 0.035);
  for (let i = 1; i <= 3; i++) {
    const y = fuzeTop + (fuzeH * i) / 4;
    ctx.beginPath(); ctx.moveTo(-fuzeW / 2, y); ctx.lineTo(fuzeW / 2, y); ctx.stroke();
  }
  ctx.fillStyle = '#7b828c'; // 顶面
  ctx.fillRect(-fuzeW / 2, fuzeTop, fuzeW, Math.max(0.6, r * 0.05));

  // ⑤ 保险握片（弹体右侧的杠杆，未被弹体遮挡）
  ctx.save();
  ctx.translate(rx * 0.34, bodyCY - ry * 0.60);
  ctx.rotate(-0.10);
  const lg = ctx.createLinearGradient(0, 0, r * 0.22, 0);
  lg.addColorStop(0, '#6d747e');
  lg.addColorStop(0.5, '#aeb5bf');
  lg.addColorStop(1, '#4a5058');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, Math.max(1, r * 0.20), Math.max(2, r * 0.86));
  ctx.restore();

  // ⑥ 拉环 + 开口销
  ctx.strokeStyle = '#ffd76b';
  ctx.lineWidth = Math.max(0.8, r * 0.10);
  ctx.beginPath(); ctx.arc(r * 0.16, fuzeTop - r * 0.20, r * 0.20, 0, 6.283); ctx.stroke();
  ctx.strokeStyle = '#c9d0da';
  ctx.lineWidth = Math.max(0.6, r * 0.055);
  ctx.beginPath();
  ctx.moveTo(r * 0.10, fuzeTop + r * 0.02);
  ctx.lineTo(r * 0.16, fuzeTop - r * 0.06);
  ctx.stroke();
}

/** 武器本体建模（按 kind 分发；在原点绘制，供拾取物 / 抛体用，阴影由调用方控制） */
export function drawWeaponModel(kind: 'ak' | 'grenade' | 'shotgun' | 'awm' | 'rocket' | 'iceBomb', r: number): void {
  if (kind === 'grenade') drawGrenadeShape(r);
  else if (kind === 'shotgun') drawShotgunShape(r);
  else if (kind === 'awm') drawAWMShape(r);
  else if (kind === 'rocket') drawRocketShape(r);
  else if (kind === 'iceBomb') drawIceBombShape(r);
  else drawAKShape(r);
}

/**
 * 武器图标通用模板（双层发光：外柔晕 + 内紧晕；中心绘制）。
 * 各枪械图标只是「图形 + 倾角 + 双色」不同，统一收敛。
 */
function glowIcon(
  shape: (r: number) => void,
  rot: number,
  outer: string,
  inner: string,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  if (rot !== 0) ctx.rotate(rot);
  ctx.shadowColor = outer;
  ctx.shadowBlur = 8;
  shape(r);
  ctx.shadowColor = inner;
  ctx.shadowBlur = 3;
  shape(r);
  ctx.shadowBlur = 0;
  ctx.restore();
}

/** AK 图标 */
export function drawAKIcon(cx: number, cy: number, r: number): void {
  glowIcon(drawAKShape, -0.15, 'rgba(255,150,60,.9)', 'rgba(255,214,150,.95)', cx, cy, r);
}

/** 手雷图标 */
export function drawGrenadeIcon(cx: number, cy: number, r: number): void {
  glowIcon(drawGrenadeShape, 0, 'rgba(150,255,140,.9)', 'rgba(214,255,206,.95)', cx, cy, r);
}

/** 霰弹枪图标 */
export function drawShotgunIcon(cx: number, cy: number, r: number): void {
  glowIcon(drawShotgunShape, -0.12, 'rgba(255,120,70,.9)', 'rgba(255,198,150,.95)', cx, cy, r);
}

/** AWM 图标 */
export function drawAWMIcon(cx: number, cy: number, r: number): void {
  glowIcon(drawAWMShape, -0.10, 'rgba(140,220,255,.9)', 'rgba(205,240,255,.95)', cx, cy, r);
}

/** 火箭筒图标 */
export function drawRocketIcon(cx: number, cy: number, r: number): void {
  glowIcon(drawRocketShape, -0.10, 'rgba(255,190,90,.9)', 'rgba(255,228,180,.95)', cx, cy, r);
}

/** 冰冻炸弹图标 */
export function drawIceBombIcon(cx: number, cy: number, r: number): void {
  glowIcon(drawIceBombShape, 0, 'rgba(120,220,255,.9)', 'rgba(220,248,255,.95)', cx, cy, r);
}

/** 武器图标统一出口（HUD / 图鉴 / 持枪用；按 kind 分发，未知回退 AK） */
export function drawWeaponIcon(cx: number, cy: number, r: number, kind: string): void {
  switch (kind) {
    case 'grenade': drawGrenadeIcon(cx, cy, r); break;
    case 'shotgun': drawShotgunIcon(cx, cy, r); break;
    case 'awm': drawAWMIcon(cx, cy, r); break;
    case 'rocket': drawRocketIcon(cx, cy, r); break;
    case 'iceBomb': drawIceBombIcon(cx, cy, r); break;
    default: drawAKIcon(cx, cy, r); break;
  }
}
