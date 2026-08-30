/* 由 sync-prefabs.mjs 自动生成，请勿手动编辑 */
window.PREFABS_DATA = {
  "generatedAt": "2026-08-30T07:36:07.831Z",
  "source": "src/Prefabs",
  "categories": [
    {
      "id": "characters",
      "title": "角色",
      "source": "Player/characters",
      "items": [
        {
          "id": "crimson-runner",
          "name": "绯红冲刺者",
          "bodyGrad": [
            "#fff2ea",
            "#ffb8a8",
            "#ff4a3c"
          ],
          "stroke": "rgba(255,170,140,.6)",
          "glow": "rgba(255,100,60,.95)",
          "eyeColor": "#2b0d12",
          "file": "Player/characters/crimson.ts"
        },
        {
          "id": "neon-runner",
          "name": "霓虹跑者",
          "bodyGrad": [
            "#ffffff",
            "#bfe9ff",
            "#5f8dff"
          ],
          "stroke": "rgba(255,255,255,.55)",
          "glow": "rgba(120,200,255,.95)",
          "eyeColor": "#1a1440",
          "file": "Player/characters/default.ts"
        }
      ]
    },
    {
      "id": "collectibles",
      "title": "收集品",
      "source": "ItemVis + WeaponVis + Scenes",
      "items": [
        {
          "id": "doubleJump",
          "name": "双跳光球",
          "glow": "rgba(120,255,170,.9)",
          "file": "ItemVis/index.ts"
        },
        {
          "id": "hook",
          "name": "钩锁道具",
          "glow": "rgba(255,180,70,.9)",
          "file": "ItemVis/index.ts"
        },
        {
          "id": "shield",
          "name": "护盾道具",
          "glow": "rgba(150,140,255,.9)",
          "file": "ItemVis/index.ts"
        },
        {
          "id": "speed",
          "name": "加速道具",
          "glow": "rgba(120,230,255,.9)",
          "file": "ItemVis/index.ts"
        },
        {
          "id": "ak",
          "name": "AK 步枪",
          "glow": "rgba(255,150,60,.9)",
          "file": "WeaponVis/index.ts"
        },
        {
          "id": "grenade",
          "name": "手雷",
          "glow": "rgba(150,255,140,.9)",
          "file": "WeaponVis/index.ts"
        },
        {
          "id": "orb",
          "name": "光球",
          "file": "Scenes/items.ts"
        },
        {
          "id": "nova",
          "name": "NOVA 星",
          "file": "Scenes/items.ts"
        },
        {
          "id": "checkpoint",
          "name": "检查点",
          "file": "Scenes/items.ts"
        }
      ]
    },
    {
      "id": "enemies",
      "title": "敌人",
      "source": "Enemy/kinds.ts",
      "items": [
        {
          "id": "walker",
          "name": "行走兵",
          "bodyGrad": [
            "#ffffff",
            "#ff9a6a",
            "#e04f2f"
          ],
          "glow": "rgba(255,110,80,.9)",
          "file": "Enemy/kinds.ts"
        }
      ]
    },
    {
      "id": "fx",
      "title": "特效",
      "source": "Fx/presets.ts",
      "items": [
        {
          "id": "death",
          "name": "死亡爆裂",
          "fx": {
            "count": 16,
            "kind": "frag",
            "colors": [
              "#7de8ff",
              "#c77dff"
            ],
            "gravity": 22,
            "life": [
              0.7,
              1.1
            ],
            "size": [
              0.14,
              0.26
            ],
            "vel": {
              "mode": "radial",
              "speed": [
                4,
                13
              ],
              "vyBias": 3
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "dust",
          "name": "落地尘土",
          "fx": {
            "count": 6,
            "kind": "dot",
            "colors": [
              "#9fb8ff"
            ],
            "gravity": 5,
            "life": [
              0.35,
              0.35
            ],
            "size": [
              0.08,
              0.08
            ],
            "vel": {
              "mode": "axis",
              "vx": [
                -1.5,
                1.5
              ],
              "vy": [
                0,
                2
              ]
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "sparkle",
          "name": "收集闪光",
          "fx": {
            "count": 14,
            "kind": "dot",
            "colors": [
              "#ffffff",
              "#8ff6ff"
            ],
            "gravity": 0,
            "life": [
              0.5,
              0.5
            ],
            "size": [
              0.09,
              0.09
            ],
            "vel": {
              "mode": "radial",
              "speed": [
                3.5,
                3.5
              ]
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "cp",
          "name": "检查点光柱",
          "fx": {
            "count": 10,
            "kind": "dot",
            "colors": [
              "#7df9ff"
            ],
            "gravity": 0,
            "life": [
              0.8,
              0.8
            ],
            "size": [
              0.08,
              0.08
            ],
            "vel": {
              "mode": "axis",
              "vx": [
                0,
                0
              ],
              "vy": [
                2,
                5
              ]
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "confetti",
          "name": "通关彩带",
          "fx": {
            "count": 80,
            "kind": "frag",
            "colors": [
              "#7de8ff",
              "#c77dff",
              "#ff8ad8",
              "#ffffff"
            ],
            "gravity": 12,
            "life": [
              1.2,
              1.2
            ],
            "size": [
              0.12,
              0.12
            ],
            "vel": {
              "mode": "radial",
              "speed": [
                3,
                11
              ],
              "vyBias": 4
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "arrowBoost",
          "name": "双跳增益环绕",
          "fx": {
            "count": 2,
            "kind": "arrow",
            "colors": [
              "#66ff99",
              "#33cc66",
              "#99ffbb"
            ],
            "gravity": 0,
            "life": [
              0.8,
              1.4
            ],
            "size": [
              0.08,
              0.12
            ],
            "vel": {
              "mode": "radial",
              "speed": [
                0.3,
                1
              ],
              "vyBias": 0.5
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "doubleJumpFx",
          "name": "二段跳触发",
          "fx": {
            "count": 8,
            "kind": "dot",
            "colors": [
              "#66ff99",
              "#33cc66",
              "#99ffbb"
            ],
            "gravity": 5,
            "life": [
              0.35,
              0.5
            ],
            "size": [
              0.08,
              0.12
            ],
            "vel": {
              "mode": "axis",
              "vx": [
                -1.6,
                1.6
              ],
              "vy": [
                0.5,
                2.2
              ]
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "shieldBreak",
          "name": "护盾破碎",
          "fx": {
            "count": 14,
            "kind": "frag",
            "colors": [
              "#b3c7ff",
              "#7d6bff",
              "#ffffff"
            ],
            "gravity": 10,
            "life": [
              0.45,
              0.7
            ],
            "size": [
              0.1,
              0.18
            ],
            "vel": {
              "mode": "radial",
              "speed": [
                3,
                9
              ]
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "speedBoost",
          "name": "加速冲刺",
          "fx": {
            "count": 12,
            "kind": "dot",
            "colors": [
              "#8ff6ff",
              "#ffffff",
              "#59d4ff"
            ],
            "gravity": 0,
            "life": [
              0.4,
              0.6
            ],
            "size": [
              0.07,
              0.1
            ],
            "vel": {
              "mode": "axis",
              "vx": [
                -7,
                7
              ],
              "vy": [
                -1.2,
                1.2
              ]
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "orbAmbient",
          "name": "光球环境光尘",
          "fx": {
            "count": 1,
            "kind": "dot",
            "colors": [
              "#bfffff",
              "#8ff6ff"
            ],
            "gravity": -0.8,
            "life": [
              1,
              1.6
            ],
            "size": [
              0.04,
              0.07
            ],
            "vel": {
              "mode": "radial",
              "speed": [
                0.15,
                0.4
              ]
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "springBurst",
          "name": "弹簧弹射火花",
          "fx": {
            "count": 10,
            "kind": "dot",
            "colors": [
              "#7dffb0",
              "#c8ffe0",
              "#59ff8f"
            ],
            "gravity": 16,
            "life": [
              0.35,
              0.6
            ],
            "size": [
              0.05,
              0.09
            ],
            "vel": {
              "mode": "axis",
              "vx": [
                -2.2,
                2.2
              ],
              "vy": [
                5,
                10
              ]
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "laserHit",
          "name": "激光命中火花",
          "fx": {
            "count": 12,
            "kind": "frag",
            "colors": [
              "#ff8ad8",
              "#ffffff",
              "#ff5fc8"
            ],
            "gravity": 14,
            "life": [
              0.4,
              0.7
            ],
            "size": [
              0.08,
              0.14
            ],
            "vel": {
              "mode": "radial",
              "speed": [
                3,
                8
              ],
              "vyBias": 2
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "novaPulse",
          "name": "NOVA 通关脉冲",
          "fx": {
            "count": 24,
            "kind": "dot",
            "colors": [
              "#ffe9a8",
              "#fff3cf",
              "#ffffff"
            ],
            "gravity": 0,
            "life": [
              0.7,
              0.7
            ],
            "size": [
              0.07,
              0.07
            ],
            "vel": {
              "mode": "radial",
              "speed": [
                4,
                4
              ]
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "deathShock",
          "name": "死亡冲击波",
          "fx": {
            "count": 1,
            "kind": "shock",
            "colors": [
              "#ff6ad5",
              "#7de8ff"
            ],
            "gravity": 0,
            "life": [
              0.42,
              0.42
            ],
            "size": [
              0.1,
              0.1
            ],
            "vel": {
              "mode": "axis",
              "vx": [
                0,
                0
              ],
              "vy": [
                0,
                0
              ]
            },
            "r0": [
              0.3,
              0.3
            ],
            "r1": [
              3.6,
              4.4
            ],
            "lw": 3
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "shieldRing",
          "name": "破盾环",
          "fx": {
            "count": 1,
            "kind": "ring",
            "colors": [
              "#b3c7ff",
              "#ffffff"
            ],
            "gravity": 0,
            "life": [
              0.38,
              0.38
            ],
            "size": [
              0.1,
              0.1
            ],
            "vel": {
              "mode": "axis",
              "vx": [
                0,
                0
              ],
              "vy": [
                0,
                0
              ]
            },
            "r0": [
              0.2,
              0.2
            ],
            "r1": [
              2.4,
              2.9
            ],
            "lw": 2.5
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "dashStreak",
          "name": "冲刺火花",
          "fx": {
            "count": 8,
            "kind": "streak",
            "colors": [
              "#8ff6ff",
              "#ffffff",
              "#59d4ff"
            ],
            "gravity": 0,
            "life": [
              0.18,
              0.32
            ],
            "size": [
              0.05,
              0.09
            ],
            "vel": {
              "mode": "axis",
              "vx": [
                -9,
                9
              ],
              "vy": [
                -1.5,
                1.5
              ]
            },
            "r0": null,
            "r1": null,
            "lw": 2
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "muzzleFlash",
          "name": "枪口火光",
          "fx": {
            "count": 6,
            "kind": "dot",
            "colors": [
              "#fff3cf",
              "#ffcf5a",
              "#ffffff"
            ],
            "gravity": 0,
            "life": [
              0.08,
              0.16
            ],
            "size": [
              0.07,
              0.13
            ],
            "vel": {
              "mode": "axis",
              "vx": [
                -1.5,
                1.5
              ],
              "vy": [
                -0.5,
                4
              ]
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "hitSpark",
          "name": "命中火花",
          "fx": {
            "count": 6,
            "kind": "frag",
            "colors": [
              "#fff3cf",
              "#ffb347",
              "#ffffff"
            ],
            "gravity": 12,
            "life": [
              0.2,
              0.4
            ],
            "size": [
              0.06,
              0.12
            ],
            "vel": {
              "mode": "radial",
              "speed": [
                2,
                6
              ]
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "weaponSpark",
          "name": "武器拾取闪光",
          "fx": {
            "count": 10,
            "kind": "frag",
            "colors": [
              "#ffcf5a",
              "#ff7a3d",
              "#fff3cf",
              "#ffffff"
            ],
            "gravity": 14,
            "life": [
              0.35,
              0.6
            ],
            "size": [
              0.07,
              0.14
            ],
            "vel": {
              "mode": "radial",
              "speed": [
                3,
                7
              ],
              "vyBias": 3
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "grenadeBoom",
          "name": "手雷爆炸",
          "fx": {
            "count": 20,
            "kind": "frag",
            "colors": [
              "#ffb347",
              "#ff6a3d",
              "#ffe9a8",
              "#ffffff"
            ],
            "gravity": 16,
            "life": [
              0.4,
              0.7
            ],
            "size": [
              0.1,
              0.22
            ],
            "vel": {
              "mode": "radial",
              "speed": [
                4,
                11
              ],
              "vyBias": 3
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "grenadeShock",
          "name": "手雷冲击环",
          "fx": {
            "count": 1,
            "kind": "shock",
            "colors": [
              "#ffb347",
              "#ffffff"
            ],
            "gravity": 0,
            "life": [
              0.35,
              0.35
            ],
            "size": [
              0.1,
              0.1
            ],
            "vel": {
              "mode": "axis",
              "vx": [
                0,
                0
              ],
              "vy": [
                0,
                0
              ]
            },
            "r0": [
              0.3,
              0.3
            ],
            "r1": [
              2.8,
              3.4
            ],
            "lw": 3
          },
          "file": "Fx/presets.ts"
        },
        {
          "id": "enemyDeath",
          "name": "敌人死亡爆裂",
          "fx": {
            "count": 14,
            "kind": "frag",
            "colors": [
              "#ff6a6a",
              "#c77dff",
              "#ff9ad8",
              "#ffffff"
            ],
            "gravity": 12,
            "life": [
              0.45,
              0.75
            ],
            "size": [
              0.1,
              0.2
            ],
            "vel": {
              "mode": "radial",
              "speed": [
                3,
                9
              ],
              "vyBias": 2
            },
            "r0": null,
            "r1": null,
            "lw": null
          },
          "file": "Fx/presets.ts"
        }
      ]
    },
    {
      "id": "hazards",
      "title": "机关",
      "source": "Scenes/hazards.ts",
      "items": [
        {
          "id": "laser",
          "name": "激光栅栏",
          "file": "Scenes/hazards.ts + platforms.ts"
        },
        {
          "id": "spike",
          "name": "尖刺",
          "file": "Scenes/hazards.ts + platforms.ts"
        },
        {
          "id": "springPadV",
          "name": "垂直弹簧",
          "file": "Scenes/hazards.ts + platforms.ts"
        },
        {
          "id": "springPadH",
          "name": "水平弹簧",
          "file": "Scenes/hazards.ts + platforms.ts"
        }
      ]
    },
    {
      "id": "platforms",
      "title": "平台与装饰",
      "source": "Scenes/platforms.ts + atmosphere.ts",
      "items": [
        {
          "id": "solid",
          "name": "静态平台",
          "file": "Scenes/platforms.ts + atmosphere.ts"
        },
        {
          "id": "mover",
          "name": "移动平台",
          "file": "Scenes/platforms.ts + atmosphere.ts"
        },
        {
          "id": "track",
          "name": "玻璃管道",
          "file": "Scenes/platforms.ts + atmosphere.ts"
        },
        {
          "id": "deco",
          "name": "装饰方块",
          "file": "Scenes/platforms.ts + atmosphere.ts"
        },
        {
          "id": "hint",
          "name": "提示文字",
          "file": "Scenes/platforms.ts + atmosphere.ts"
        }
      ]
    }
  ]
};
