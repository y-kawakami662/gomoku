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
  scene.background = new THREE.Color(0x262626);

  const width = root.clientWidth || 320;
  const height = root.clientHeight || 480;

  // ----- レンダラー（描画装置） -----
  // antialias: true で輪郭が滑らかに、toneMapping で見た目を自然に。
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(scene.background, 1);
  root.appendChild(renderer.domElement);

  // ----- カメラ（見ている位置） -----
  // position の 3 つの値を調整すると、距離・高さ・横位置が変わります。
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);
  camera.position.set(0, 1.35, 1.5);
  camera.lookAt(0, 1.25, 0);

  // ----- ライト（照明） -----
  // 第2引数が強度。暗い/明るいと感じたら数値を上下してください。
  const light1 = new THREE.DirectionalLight(0xffffff, 1.0);
  light1.position.set(1.0, 1.8, 1.2);
  scene.add(light1);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
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
          currentVRM.expressionManager.setValue?.(VRMExpressionPresetName.Blink, blinkValue);
        } catch (_) { /* noop */ }
      }
      currentVRM.update(delta);
    }
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
}
