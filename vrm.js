/*
 * VRM ビューア（右サイド表示）
 * ------------------------------------------------------------
 * 目的:
 *   - ページ右側のパネルに VRM アバター（Assets/AvatarSample_A.vrm）を表示します。
 *   - ほんのり「待機モーション（呼吸・腕スイング・瞬き）」を付けています。
 *
 * 前提:
 *   - index.html 側で import map を設定しています（three / GLTFLoader / @pixiv/three-vrm）。
 *   - ブラウザで開くと CDN からモジュールが読み込まれます。オフライン運用は別途バンドルが必要です。
 *
 * よく触る調整ポイント（初心者向け）:
 *   1) カメラ位置（camera.position） … 距離・高さを変えると見え方が変わります。
 *   2) ライト強度（DirectionalLight, HemisphereLight の第2引数） … 明るさの調整。
 *   3) 背景色（scene.background） … パネルの背景カラー。
 *   4) ニュートラル姿勢（neutral.* の角度） … Tポーズを和らげる初期角度（度数で指定→内部でラジアンに変換）。
 *   5) 揺れの強さ・速さ（applyIdleMotion 内の Math.sin の係数や角度） … モーションの雰囲気を調整。
 *   6) 瞬き（period / nextBlinkAt の範囲） … 瞬きの頻度や長さを調整。
 *
 * 使い方:
 *   - 値を少しずつ変えてブラウザをリロードしてください。
 *   - うまくいかない場合は Console のログ（[VRM] ...）を確認します。
 */

// Import（index.html の import map を使用）
//   ・記述はベアインポート（"three" など）ですが、実体は esm.sh にマップされています。
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, VRMHumanBoneName, VRMExpressionPresetName } from "@pixiv/three-vrm";

// VRM を表示するパネルの要素（index.html の <aside id="vrmViewer">）
const container = document.getElementById("vrmViewer");
if (!container) {
  console.warn("VRM viewer container not found; skipping VRM setup.");
} else {
  console.info("[VRM] init viewer", { w: container.clientWidth, h: container.clientHeight });
  setupVRMViewer(container, "Assets/AvatarSample_A.vrm");
}

function setupVRMViewer(root, vrmPath) {
  // ----- シーン（入れ物）と背景色 -----
  const scene = new THREE.Scene();
  // 背景は CSS のグラデーションを見せたいので Three.js 側は透明にします
  // （CSS 側の .vrm-viewer の background を参照）
  // scene.background = new THREE.Color(0x262626);

  const width = root.clientWidth || 320;
  const height = root.clientHeight || 480;

  // ----- レンダラー（描画装置） -----
  // antialias: true で輪郭が滑らかに、toneMapping で見た目を自然に。
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // キャラクターの色味を変えないため、トーンマッピングは無効化（必要なら Exposure も未使用）
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.0;
  // 透明背景（CSS 背景を活かす）
  renderer.setClearColor(0x000000, 0);
  root.appendChild(renderer.domElement);

  // ----- カメラ（見ている位置） -----
  // position の 3 つの値を調整すると、距離・高さ・横位置が変わります。
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);
  camera.position.set(0, 1.35, 1.5);
  camera.lookAt(0, 1.25, 0);

  // ----- ライト（照明） -----
  // 第2引数が強度。暗い/明るいと感じたら数値を上下してください。
  // 「キャラクターの左上（カメラ視点）」から当たるキーライト。
  // 顔の白飛びを抑えるため、強度をやや弱め(0.7)にしています。
  const light1 = new THREE.DirectionalLight(0xffffff, 0.7);
  light1.position.set(-1.4, 2.4, 1.6);
  scene.add(light1);

  // 柔らかい環境光。空(上)は白、地面(下)はやや暗めのグレーでコントラストを保ちます。
  const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2a2a, 0.35);
  hemi.position.set(0, 2, 0);
  scene.add(hemi);

  // ----- 地面（うっすら反射っぽい） -----
  // 色を変えると全体の雰囲気が変わります。透明にしたい場合は追加で material.opacity などが必要です。
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshPhongMaterial({ color: 0x2f2f2f, shininess: 20 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.0;
  scene.add(ground);

  // リムライト（背後からの縁取り光）。顔を明るくしすぎないために弱めに設定。
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.25);
  rimLight.position.set(0.8, 1.2, -1.6);
  scene.add(rimLight);

  // ----- きらきらパーティクル（華やかさ演出） -----
  // 数値を上下すると粒の数やサイズ、回転速度が変わります。
  const sparkleGroup = new THREE.Group();
  scene.add(sparkleGroup);

  function createCircleSpriteTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const sparkleTex = createCircleSpriteTexture();

  function addSparkleLayer(count, size, color, radius, yBase) {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = radius * (0.5 + Math.random() * 0.5);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = yBase + r * 0.25 * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta) - 0.5; // ほんの少し奥に
      positions[i*3 + 0] = x;
      positions[i*3 + 1] = y;
      positions[i*3 + 2] = z;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      size,
      map: sparkleTex,
      color,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.8,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geom, mat);
    sparkleGroup.add(points);
    return points;
  }

  // レイヤーを3つ作成（大小＋色違い）
  const sparkles = [
    addSparkleLayer(220, 0.06, new THREE.Color('#ffffff'), 5.5, 0.8),
    addSparkleLayer(140, 0.10, new THREE.Color('#ffd1fa'), 4.0, 1.0),
    addSparkleLayer(100, 0.14, new THREE.Color('#aee2ff'), 3.0, 1.2),
  ];

  // ----- VRM の読み込み設定 -----
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  let currentVRM = null;
  let bones = null; // cache of important bones for idle motion
  let boneBase = null; // initial rotations
  const neutral = {}; // neutral offset to avoid T-pose
  let elapsed = 0;
  let blinkElapsed = 0;
  let nextBlinkAt = 2 + Math.random() * 3; // seconds

  // ----- 口パク（AI手番時に使用） -----
  // startTalking(ms) が呼ばれると、指定時間ランダムに口形を切り替えます。
  let talkRemain = 0;     // 残り時間（秒）
  let talkSwitch = 0;     // 次に切り替えるまでの残り（秒）
  // 使用するプリセット名（モデル/three-vrm のバージョンにより異なるため、ロード後に自動検出で上書き）
  let visemes = ['A','I','U','E','O']; // 仮の初期値
  let blinkPreset = 'Blink';
  let currentViseme = null;
  let visemeUsable = true; // モデルに Viseme が無い場合は顎ボーン回転にフォールバック
  let jawNode = null;
  // 勝利時の笑顔エフェクト
  let smileRemain = 0;     // 残り時間（秒）
  let smileStrength = 0.8; // 最大強度（0〜1）
  // 敗北時の悲しい表情エフェクト
  let sadRemain = 0;
  let sadStrength = 0.8;

  console.info("[VRM] loading", vrmPath);
  // キャッシュで 304 が返って読み込みに失敗する環境を避けるため、クエリでキャッシュバスターを付けています。
  const bust = `v=${Date.now()}`;
  const url = vrmPath.includes("?") ? `${vrmPath}&${bust}` : `${vrmPath}?${bust}`;
  loader.load(
    url,
    (gltf) => {
      const vrm = gltf.userData.vrm;
      if (!vrm) return;

      // 最適化（不要頂点・ジョイントの削除）
      VRMUtils.removeUnnecessaryVertices(vrm.scene);
      VRMUtils.removeUnnecessaryJoints(vrm.scene);

      // カメラの方向を向かせる（y 回転）。左右反転したら角度を -Math.PI に。
      vrm.scene.rotation.y = Math.PI; // face the camera
      vrm.scene.position.set(0, 0.0, 0);
      // マテリアルの色空間を修正（暗く/白飛びする場合に効果）
      if (typeof VRMUtils.rotateVRM0 === "function") {
        try { VRMUtils.rotateVRM0(vrm); } catch (_) { /* noop */ }
      }
      vrm.scene.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          const mtl = obj.material;
          if (mtl.map) mtl.map.colorSpace = THREE.SRGBColorSpace;
          if (mtl.emissiveMap) mtl.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        }
      });
      scene.add(vrm.scene);
      console.info("[VRM] loaded");
      currentVRM = vrm;

      // 方向性ライトの狙い先（ターゲット）をキャラクターの頭付近に設定
      // target は Object3D。VRM の子にするとボブ（上下ゆれ）とも連動します。
      light1.target.position.set(0, 1.35, 0);
      vrm.scene.add(light1.target);
      // リムライトのターゲットも同様に頭付近へ
      // rimLight は上方・背面側から縁取りを作る用です。
      rimLight.target.position.set(0, 1.35, 0);
      vrm.scene.add(rimLight.target);

      // ----- 待機モーション用: 必要なボーンをキャッシュ -----
      try {
        const h = vrm.humanoid;
        if (h) {
          bones = {
            neck: h.getNormalizedBoneNode?.(VRMHumanBoneName.Neck) || null,
            spine: h.getNormalizedBoneNode?.(VRMHumanBoneName.Spine) || null,
            chest: h.getNormalizedBoneNode?.(VRMHumanBoneName.Chest) || null,
            leftUpperArm: h.getNormalizedBoneNode?.(VRMHumanBoneName.LeftUpperArm) || null,
            rightUpperArm: h.getNormalizedBoneNode?.(VRMHumanBoneName.RightUpperArm) || null,
            leftLowerArm: h.getNormalizedBoneNode?.(VRMHumanBoneName.LeftLowerArm) || null,
            rightLowerArm: h.getNormalizedBoneNode?.(VRMHumanBoneName.RightLowerArm) || null,
          };
          // 顎ボーン（無いモデルもあります）
          jawNode = h.getNormalizedBoneNode?.(VRMHumanBoneName.Jaw) || null;

          // 各ボーンの初期回転を保存（常に「初期＋オフセット＋揺れ」で上書きするため）
          boneBase = {};
          for (const [k, node] of Object.entries(bones)) {
            if (node) boneBase[k] = { x: node.rotation.x, y: node.rotation.y, z: node.rotation.z };
          }

          // ----- ニュートラル姿勢（Tポーズを和らげるためのオフセット角）-----
          // 単位: 度（deg）。大きくしすぎると不自然になるので少しずつ調整。
          const d = THREE.MathUtils.degToRad;
          neutral.spine = { x: d(2), y: 0, z: 0 };
          neutral.chest = { x: d(3), y: 0, z: 0 };
          neutral.neck = { x: 0, y: 0, z: 0 };
          neutral.leftUpperArm = { x: d(5), y: 0, z: d(75) };
          neutral.rightUpperArm = { x: d(5), y: 0, z: d(-75) };
          neutral.leftLowerArm = { x: 0, y: 0, z: d(-5) };
          neutral.rightLowerArm = { x: 0, y: 0, z: d(5) };
        }
      } catch (_) {
        bones = null;
      }

      // Viseme/瞬きのプリセット名を自動検出（大文字/小文字の違いに対応）
      (function detectPresets(){
        const em = currentVRM.expressionManager;
        const known = new Set();
        const collect = (obj) => {
          try {
            if (!obj) return;
            if (obj instanceof Map) { for (const k of obj.keys()) known.add(String(k)); }
            else if (Array.isArray(obj)) { obj.forEach((k)=>known.add(String(k))); }
            else { Object.keys(obj).forEach((k)=>known.add(String(k))); }
          } catch {}
        };
        collect(em?.mouthExpressionNames);
        collect(em?.blinkExpressionNames);
        collect(em?.presetExpressionMap || em?.expressionMap || em?.expressions);

        const sets = [
          ['A','I','U','E','O'],         // 先頭大文字（ユーザーの環境で想定）
          ['Aa','Ih','Ou','Ee','Oh'],    // パスカル風
          ['aa','ih','ou','ee','oh'],    // 小文字
        ];
        const score = (list) => list.reduce((n,k)=> n + (known.has(k)?1:0), 0);
        let best = sets[0];
        let bestScore = score(best);
        for (const s of sets.slice(1)) {
          const sc = score(s);
          if (sc > bestScore) { best = s; bestScore = sc; }
        }
        visemes = best;
        visemeUsable = bestScore >= 1; // 1つでもあれば使う（モデルにより一部のみ定義のことあり）
        blinkPreset = known.has('Blink') ? 'Blink' : (known.has('blink') ? 'blink' : 'Blink');
        console.info('[VRM] 表情検出:', { mouth: visemes, blink: blinkPreset });
        if (!visemeUsable) console.info('[VRM] Viseme 未定義。顎ボーン回転で口パクします。');
      })();
    },
    undefined,
    (err) => {
      console.error("Failed to load VRM:", err);
    }
  );

  // ----- リサイズ対応（パネルの大きさが変わったら再計算） -----
  const resize = () => {
    const w = root.clientWidth || 320;
    const h = root.clientHeight || 480;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(root);

  // ----- 毎フレームの更新（アニメーションループ） -----
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    elapsed += delta;
    if (currentVRM && typeof currentVRM.update === "function") {
      // アイドルモーション（呼吸・腕スイング）
      if (bones) {
        applyIdleMotion(bones, elapsed);
      }
      // 瞬き（Blink）。period と nextBlinkAt を調整すると頻度/長さが変わります。
      if (currentVRM.expressionManager) {
        blinkElapsed += delta;
        let blinkValue = 0;
        if (blinkElapsed > nextBlinkAt) {
          const period = 0.16; // 1回の瞬きの長さ（秒）
          const p = (blinkElapsed - nextBlinkAt) / period;
          if (p < 1) {
            // simple up-down shape
            blinkValue = p < 0.5 ? p * 2 : (1 - p) * 2;
          } else {
            // schedule next blink
            blinkElapsed = 0;
            nextBlinkAt = 2 + Math.random() * 4; // 次の瞬きまでの待ち時間（秒）
          }
        }
        try {
          currentVRM.expressionManager.setValue?.(blinkPreset, blinkValue);
        } catch (_) { /* noop */ }

        // 口パク（talkRemain がある間）
        if (talkRemain > 0) {
          talkRemain -= delta;
          talkSwitch -= delta;
          if (talkSwitch <= 0 || !currentViseme) {
            // 切り替え：120〜180ms 間隔でランダムに Viseme を選ぶ
            currentViseme = visemes[Math.floor(Math.random() * visemes.length)];
            talkSwitch = 0.12 + Math.random() * 0.06;
          }

          if (visemeUsable) {
            // いったん全て 0 にして、現在の Viseme を強めに（0.9）入れる
            for (const v of visemes) {
              currentVRM.expressionManager.setValue?.(v, v === currentViseme ? 0.9 : 0);
            }
          } else if (jawNode) {
            // フォールバック：顎を開閉（0.0〜0.35rad 付近）
            const open = 0.15 + Math.random() * 0.2; // 少しランダム幅
            jawNode.rotation.x = open;
          }
        } else {
          // 終了処理（口形状/顎を元に戻す）
          if (visemeUsable && currentViseme) {
            for (const v of visemes) {
              currentVRM.expressionManager.setValue?.(v, 0);
            }
            currentViseme = null;
          }
          if (jawNode) jawNode.rotation.x = 0;
        }
        // 勝利時スマイルの減衰（シンプルな線形フェード）
        if (smileRemain > 0) {
          smileRemain -= delta;
          const t = Math.max(0, smileRemain);
          const v = Math.min(1, t / 0.9) * smileStrength; // 0.9秒基準で緩やかに
          try { currentVRM.expressionManager.setValue?.(VRMExpressionPresetName.Happy, v); } catch (_) {}
        } else {
          try { currentVRM.expressionManager.setValue?.(VRMExpressionPresetName.Happy, 0); } catch (_) {}
        }

        // 敗北時サッドの減衰
        if (sadRemain > 0) {
          sadRemain -= delta;
          const t = Math.max(0, sadRemain);
          const v = Math.min(1, t / 0.9) * sadStrength;
          try { currentVRM.expressionManager.setValue?.(VRMExpressionPresetName.Sad, v); } catch (_) {}
        } else {
          try { currentVRM.expressionManager.setValue?.(VRMExpressionPresetName.Sad, 0); } catch (_) {}
        }

        // 念のため表情計算を更新
        try { currentVRM.expressionManager.update?.(delta); } catch (_) {}
      }
      currentVRM.update(delta);
    }

    // きらきらの回転・明滅（キャラクターの色味には影響しません）
    sparkleGroup.rotation.y += delta * 0.08;
    // sparkles.forEach((p, i) => {
    //   const m = p.material; // PointsMaterial
    //   m.opacity = 0.6 + Math.sin(elapsed * (0.8 + i * 0.3)) * 0.2;
    // });

    renderer.render(scene, camera);
  });

  // ----- アイドルモーションの本体 -----
  // 数字を変えても壊れません。少しずつ試して好みの雰囲気にしてください。
  function applyIdleMotion(b, t) {
    if (!boneBase) return;
    const d = THREE.MathUtils.degToRad;
    const breath = Math.sin(t * 1.2) * d(2.2); // 呼吸の強さ/速さ
    const sway = Math.sin(t * 0.7) * d(3.0);  // 上半身の左右ゆれ
    const arm  = Math.sin(t * 0.8) * d(4.0);  // 腕スイングの強さ

    const setRot = (node, base, off, add) => {
      if (!node || !base) return;
      node.rotation.x = (base.x || 0) + (off?.x || 0) + (add?.x || 0);
      node.rotation.y = (base.y || 0) + (off?.y || 0) + (add?.y || 0);
      node.rotation.z = (base.z || 0) + (off?.z || 0) + (add?.z || 0);
    };

    setRot(b.spine, boneBase.spine, neutral.spine, { x: breath * 0.6, y: sway * 0.3 });
    setRot(b.chest, boneBase.chest, neutral.chest, { x: breath, y: sway });
    setRot(b.neck, boneBase.neck, neutral.neck, { x: breath * 0.3, y: sway * 0.5 });
    setRot(b.leftUpperArm, boneBase.leftUpperArm, neutral.leftUpperArm, { z: arm * 0.5 });
    setRot(b.rightUpperArm, boneBase.rightUpperArm, neutral.rightUpperArm, { z: -arm * 0.5 });
    setRot(b.leftLowerArm, boneBase.leftLowerArm, neutral.leftLowerArm, null);
    setRot(b.rightLowerArm, boneBase.rightLowerArm, neutral.rightLowerArm, null);

    // gentle up-down bob of whole body
    if (currentVRM) {
      currentVRM.scene.position.y = 0.02 * Math.sin(t * 1.2); // 体全体の上下ゆれ（強さ）
    }
  }

  // ----- 外部API: 口パク開始（ミリ秒） -----
  // 例: window.vrmTalk.start(350)
  function startTalking(ms = 300) {
    talkRemain = Math.max(0, ms) / 1000; // 秒に変換
    talkSwitch = 0; // すぐ次の音素に切り替える
  }

  // 口を閉じる（viseme/jaw をリセット）
  function closeMouth() {
    try {
      if (currentVRM?.expressionManager) {
        for (const v of visemes) currentVRM.expressionManager.setValue?.(v, 0);
        currentVRM.expressionManager.update?.(0);
      }
      if (jawNode) jawNode.rotation.x = 0;
      currentViseme = null;
      talkRemain = 0;
      talkSwitch = 0;
    } catch (_) {}
  }

  // グローバルで簡単に呼べるように window に公開
  // 存在チェック付きで上書き安全に
  window.vrmTalk = Object.assign(window.vrmTalk || {}, { start: startTalking, close: closeMouth });

  // ----- 外部API: 勝利時スマイル -----
  // 例: window.vrmFace.smile(900, 0.9)
  function smile(ms = 900, strength = 0.85) {
    smileRemain = Math.max(0, ms) / 1000;
    smileStrength = Math.max(0, Math.min(1, strength));
  }
  // ----- 外部API: 敗北時サッド -----
  // 例: window.vrmFace.sad(3000, 0.8)
  function sad(ms = 3000, strength = 0.8) {
    sadRemain = Math.max(0, ms) / 1000;
    sadStrength = Math.max(0, Math.min(1, strength));
  }
  window.vrmFace = Object.assign(window.vrmFace || {}, { smile, sad });
}
