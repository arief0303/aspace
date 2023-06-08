import { ref, onMounted, onUnmounted } from 'vue'
import { useEventListener } from '@vueuse/core'
import * as BABYLON from 'babylonjs'
// import { CharacterController } from "babylonjs-charactercontroller";
import CharacterController from './CharacterController'
import * as Colyseus from "colyseus.js";
import Stats from "stats-js";
import "babylonjs-loaders";
import Player from './Player';
import JoystickController from "joystick-controller";

var statsFPS = new Stats();
statsFPS.domElement.style.cssText = "position:absolute;top:3px;left:3px;";
statsFPS.showPanel(0); // 0: fps,

var statsMemory = new Stats();
statsMemory.showPanel(2); //2: mb, 1: ms, 3+: custom
statsMemory.domElement.style.cssText = "position:absolute;top:3px;left:84px;";

//add stats for FPS and Memory usage
document.body.appendChild(statsFPS.dom);
document.body.appendChild(statsMemory.dom);

export default {
    setup() {
        const canvas = ref(null)
        let engine = null
        let scene = null

        const init = () => {
            engine = new BABYLON.Engine(canvas.value, true)
            scene = new BABYLON.Scene(engine)

            /* 
            let client = new Colyseus.Client("ws://localhost:2567");
            console.log("Connecting to Colyseus server...");
            //
            // Connect with Colyseus server
            //
            let room = client.joinOrCreate("my_room");
            console.log("Connected to Colyseus server!");
            */
            loadPlayer(scene, engine, canvas);

            // Our built-in 'ground' shape.
            const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 24, height: 24 }, scene);
            ground.checkCollisions = true;

            // create a light
            const light = new BABYLON.HemisphericLight(
                'light',
                new BABYLON.Vector3(0, 1, 0),
                scene
            )

            function loadPlayer(scene, engine, canvas) {
                BABYLON.SceneLoader.ImportMesh("", "assets/player/", "ybot.glb", scene, (meshes, particleSystems, skeletons, animationGroups) => {
                    var player = meshes[0];
                    player.rotation = player.rotationQuaternion.toEulerAngles();
                    player.rotationQuaternion = null;
                    // set the blending speed for the group
                    animationGroups.blendingSpeed = 0.01; // adjust this value to control the blending speed
                    const myAgmap = {
                        "idle": animationGroups[0],
                        "walk": animationGroups[6],
                        "run": animationGroups[2],
                        "walkBack": animationGroups[7],
                        "turnLeft": animationGroups[4],
                        "turnRight": animationGroups[5],
                        "runJump": animationGroups[3],
                        "idleJump": animationGroups[1]
                    };

                    //if the skeleton does not have any animation ranges then set them as below
                    // setAnimationRanges(skeleton);
                    //rotate the camera behind the player
                    var alpha = -player.rotation.y - 4.69;
                    var beta = Math.PI / 2.5;
                    var target = new BABYLON.Vector3(player.position.x, player.position.y + 1.5, player.position.z);
                    var camera = new BABYLON.ArcRotateCamera("ArcRotateCamera", alpha, beta, 5, target, scene);
                    //standard camera setting
                    camera.wheelPrecision = 15;
                    camera.checkCollisions = false;
                    //make sure the keyboard keys controlling camera are different from those controlling player
                    //here we will not use any keyboard keys to control camera
                    camera.keysLeft = [];
                    camera.keysRight = [];
                    camera.keysUp = [];
                    camera.keysDown = [];
                    //how close can the camera come to player
                    camera.lowerRadiusLimit = 2;
                    //how far can the camera go from the player
                    camera.upperRadiusLimit = 20;
                    // camera.attachControl(canvas, false);

                    //var CharacterController = org.ssatguru.babylonjs.component.CharacterController;
                    var cc = new CharacterController(player, camera, scene);
                    cc.setupConfig(myAgmap);
                    cc.enableBlending();
                    // cc.setTurningOff(false);
                    //below makes the controller point the camera at the player head which is approx
                    //1.5m above the player origin
                    // cc.setCameraTarget(new BABYLON.Vector3(0, 1.5, 0));
                    // cc.setCameraElasticity(false);
                    //if the camera comes close to the player we want to enter first person mode.
                    // cc.setNoFirstPerson(true);
                    //the height of steps which the player can climb
                    // cc.setStepOffset(0.4);
                    //the minimum and maximum slope the player can go up
                    //between the two the player will start sliding down if it stops
                    // cc.setSlopeLimit(30, 60);

                    //tell controller 
                    // - which animation range should be used for which player animation
                    // - rate at which to play that animation range
                    // - wether the animation range should be looped
                    //use this if name, rate or looping is different from default
                    // cc.setIdleAnim("idle", 1, true);
                    // cc.setTurnLeftAnim("turnLeft", 0.5, true);
                    // cc.setTurnRightAnim("turnRight", 0.5, true);
                    // cc.setWalkBackAnim("walkBack", 0.5, true);
                    // cc.setIdleJumpAnim("idleJump", 0.6, false);
                    // cc.setRunJumpAnim("runJump", 0.6, false);
                    //set the animation range name to "null" to prevent the controller from playing
                    //a player animation.
                    //here even though we have an animation range called "fall" we donot want to play 
                    //the fall animation
                    // cc.setFallAnim("fall", 2, false);
                    // cc.setSlideBackAnim("slideBack", 1, false)
                    animationGroups[0].stop(); //stop default animation from playing overlapping with idle anim
                    cc.start();

                    const joystick = new JoystickController(
                        {
                            maxRange: 70,
                            level: 10,
                            radius: 50,
                            joystickRadius: 30,
                            opacity: 0.5,
                            leftToRight: false,
                            bottomToUp: true,
                            containerClass: "joystick-container",
                            controllerClass: "joystick-controller",
                            joystickClass: "joystick",
                            distortion: false,
                            x: "25%",
                            y: "25%",
                            dynamicPosition: true,
                        },
                        ({ x, y, leveledX, leveledY, distance, angle }) => {
                            console.log(x, y, leveledX, leveledY, distance, angle)
                            if (y > 45) {
                                cc.walk(true)
                            }

                            if (y <= -45) {
                                cc.walkBack(true);
                            }

                            if (y > -45 && y <= 45) {
                                cc.walk(false)
                                cc.walkBack(false);
                            }

                            if (x > 40) {
                                cc.turnRight(true);
                            }
                            if (x < -40) {
                                cc.turnLeft(true);
                            }

                            if (x <= 40 && x > -40) {
                                cc.turnLeft(false);
                                cc.turnRight(false);
                            }
                        }

                    );

                    // Render loop
                    engine.runRenderLoop(function () {
                        scene.render();
                        //update stats
                        statsFPS.update();
                        statsMemory.update();
                    });
                });
            }
        }

        const handleResize = () => {
            if (engine) {
                engine.resize()
            }
        }

        onMounted(() => {
            init()
            useEventListener(window, 'resize', handleResize)
        })

        onUnmounted(() => {
            engine.dispose()
        })

        return {
            canvas
        }
    },
}