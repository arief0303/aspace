import { Mesh, TransformNode, Vector3, Ray, AnimationGroup } from 'babylonjs'
export default class CharacterController {
    constructor(avatar, camera, scene, room = undefined, actionMap, faceForward) {
        console.log(avatar)

        var _this = this;
        this._room = room;
        if (faceForward === void 0) { faceForward = false; }
        this._avatar = null;
        this._skeleton = null;
        this._shouldIdle = false;
        this._gravity = 9.8;
        this._minSlopeLimit = 30;
        this._maxSlopeLimit = 45;
        this._sl1 = Math.PI * this._minSlopeLimit / 180;
        this._sl2 = Math.PI * this._maxSlopeLimit / 180;
        this._stepOffset = 0.25;
        this._vMoveTot = 0;
        this._vMovStartPos = new Vector3.Zero();
        this._actionMap = new ActionMap();
        this._cameraElastic = true;
        this._cameraTarget = new Vector3.Zero();
        this._noFirstPerson = false;
        this._mode = 0;
        this._saveMode = 0;
        this._isRHS = false;
        this._signRHS = -1;
        this._started = false;
        this._startAnim = false;
        this._stopAnim = false;
        this._prevAnim = null;
        this._avStartPos = new Vector3.Zero();
        this._grounded = false;
        this._freeFallDist = 0;
        this._fallFrameCountMin = 50;
        this._fallFrameCount = 0;
        this._inFreeFall = false;
        this._wasWalking = false;
        this._wasRunning = false;
        this._jumpStartPosY = 0;
        this._jumpTime = 0;
        this._movFallTime = 0;
        this._sign = 1;
        this._isTurning = false;
        this._noRot = false;
        this._idleFallTime = 0;
        this._groundFrameCount = 0;
        this._groundFrameMax = 10;
        this._savedCameraCollision = true;
        this._inFP = false;
        this._ray = new Ray(new Vector3.Zero(), new Vector3.One(), 1);
        this._rayDir = new Vector3.Zero();
        this._cameraSkin = 0.5;
        this._skip = 0;
        this._move = false;
        this._isAG = false;
        this._hasAnims = false;
        this._camera = camera;
        this._scene = scene;
        var success = this.setAvatar(avatar, faceForward);
        if (!success) {
            console.error("unable to set avatar");
        }
        var dataType = null;
        if (actionMap != null) {
            dataType = this.setActionMap(actionMap);
        }
        if (!this._isAG && this._skeleton != null)
            this._checkAnimRanges(this._skeleton);
        if (this._isAG) {
        }
        this._act = new _Action();

        this._savedCameraCollision = this._camera.checkCollisions;
        this._renderer = function () { _this._moveAVandCamera(); };
        //check is other player controller
        this._handleKeyUp = function (e) { _this._onKeyUp(e); };
        this._handleKeyDown = function (e) { _this._onKeyDown(e); };
        this._soundManager = new Map();
        this._walkingSfx = null;
        // this.loadSFX();
    };

    getScene = () => {
        return this._scene;
    };
    loadSFX = () => {
        let listSFX = [
            {
                name: "WalkSound",
                path: "",
                options: {
                    loop: false,
                    volume: 0.60,
                    playbackRate: 0.6
                }
            }
        ];
        listSFX.forEach((s) => {
            let sound = new Sound(s.name, s.path, this._scene, null, s.options);
            this._soundManager.set(s.name, sound);
        });
        this._walkingSfx = new Sound("walking", "/sounds/walking.wav", this._scene, function () {
        }, {
            loop: false,
            volume: 0.20,
            playbackRate: 0.6,
            autoplay: true
        });

    }
    getSound = () => {
        return
    }

    setSlopeLimit = function (minSlopeLimit, maxSlopeLimit) {
        this._minSlopeLimit = minSlopeLimit;
        this._maxSlopeLimit = maxSlopeLimit;
        this._sl1 = Math.PI * this._minSlopeLimit / 180;
        this._sl2 = Math.PI * this._maxSlopeLimit / 180;
    };
    setStepOffset = function (stepOffset) {
        this._stepOffset = stepOffset;
    };
    setWalkSpeed = (n) => {
        this._actionMap.walk.speed = n;
    };
    setRunSpeed = (n) => {
        this._actionMap.run.speed = n;
    };
    setBackSpeed = function (n) {
        this._actionMap.walkBack.speed = n;
    };
    setBackFastSpeed = function (n) {
        this._actionMap.walkBackFast.speed = n;
    };
    setJumpSpeed = function (n) {
        this._actionMap.idleJump.speed = n;
        this._actionMap.runJump.speed = n;
    };
    setLeftSpeed = function (n) {
        this._actionMap.strafeLeft.speed = n;
    };
    setLeftFastSpeed = function (n) {
        this._actionMap.strafeLeftFast.speed = n;
    };
    setRightSpeed = function (n) {
        this._actionMap.strafeRight.speed = n;
    };
    setRightFastSpeed = function (n) {
        this._actionMap.strafeLeftFast.speed = n;
    };
    setTurnSpeed = function (n) {
        this._actionMap.turnLeft.speed = n * Math.PI / 180;
        this._actionMap.turnRight.speed = n * Math.PI / 180;
    };
    setTurnFastSpeed = function (n) {
        this._actionMap.turnLeftFast.speed = n * Math.PI / 180;
        this._actionMap.turnRightFast.speed = n * Math.PI / 180;
    };
    setGravity = function (n) {
        this._gravity = n;
    };
    setAnimationGroups = function (agMap) {
        if (this._prevAnim != null && this._prevAnim.exist)
            this._prevAnim.ag.stop();
        this._isAG = true;
        this.setActionMap(agMap);
    };
    setAnimationRanges = function (arMap) {
        this._isAG = false;
        this.setActionMap(arMap);
    };
    setActionMap = function (inActMap) {
        var agMap = false;
        var inActData;
        var ccActionNames = Object.keys(this._actionMap);
        for (var _i = 0, ccActionNames_1 = ccActionNames; _i < ccActionNames_1.length; _i++) {
            var ccActionName = ccActionNames_1[_i];
            var ccActData = this._actionMap[ccActionName];
            if (!(ccActData instanceof ActionData))
                continue;
            ccActData.exist = false;
            inActData = inActMap[ccActData.id];
            // console.log(ccActData.id);
            // console.log(inActMap["walk"]);
            // console.log(inActData);
            if (inActData != null) {
                if (inActData instanceof AnimationGroup) {
                    ccActData.ag = inActData;
                    ccActData.name = ccActData.ag.name;
                    ccActData.exist = true;
                    agMap = true;
                    this._hasAnims = true;
                }
                else if (inActData.exist) {
                    this._hasAnims = true;
                    ccActData.exist = true;
                    if (inActData instanceof Object) {
                        if (inActData.ag) {
                            ccActData.ag = inActData.ag;
                            agMap = true;
                        }
                        if (inActData.name) {
                            ccActData.name = inActData.name;
                        }
                        if (inActData.loop != null)
                            ccActData.loop = inActData.loop;
                        if (inActData.rate)
                            ccActData.rate = inActData.rate;
                        if (inActData.speed)
                            ccActData.speed = inActData.speed;
                        if (inActData.sound)
                            ccActData.sound = inActData.sound;
                    }
                    else {
                        ccActData.name = inActData;
                    }
                }
            }
        }
        this._checkFastAnims();
        this._prevAnim = null;
        if (agMap)
            return "ag";
        else
            return "ar";
    };
    getActionMap = function () {
        var map = new ActionMap();
        var keys = Object.keys(this._actionMap);
        for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
            var key = keys_1[_i];
            var actDataI = this._actionMap[key];
            if (!(actDataI instanceof ActionData))
                continue;
            if (!actDataI.exist)
                continue;
            var actDataO = map[actDataI.id];
            actDataO.ag = actDataI.ag;
            actDataO.name = actDataI.name;
            actDataO.loop = actDataI.loop;
            actDataO.rate = actDataI.rate;
            actDataO.speed = actDataI.speed;
            actDataO.key = actDataI.key;
            actDataO.sound = actDataI.sound;
            actDataO.exist = actDataI.exist;
        }
        return map;
    };
    getSettings = function () {
        var ccs = new CCSettings();
        ccs.faceForward = this.isFaceForward();
        ccs.topDown = this.getMode() == 1 ? true : false;
        ccs.turningOff = this.isTurningOff();
        ccs.cameraTarget = this._cameraTarget.clone();
        ccs.cameraElastic = this._cameraElastic;
        ccs.gravity = this._gravity;
        ccs.keyboard = this._ekb;
        ccs.maxSlopeLimit = this._maxSlopeLimit;
        ccs.minSlopeLimit = this._minSlopeLimit;
        ccs.noFirstPerson = this._noFirstPerson;
        ccs.stepOffset = this._stepOffset;
        return ccs;
    };
    setSettings = function (ccs) {
        this.setFaceForward(ccs.faceForward);
        this.setMode(ccs.topDown ? 1 : 0);
        this.setTurningOff(ccs.turningOff);
        this.setCameraTarget(ccs.cameraTarget);
        this.setCameraElasticity(ccs.cameraElastic);
        this.setGravity(ccs.gravity);
        this.enableKeyBoard(ccs.keyboard);
        this.setSlopeLimit(ccs.minSlopeLimit, ccs.maxSlopeLimit);
        this.setNoFirstPerson(ccs.noFirstPerson);
        this.setStepOffset(ccs.stepOffset);
    };

    _setAnim = function (anim, animName, rate, loop) {
        if (!this._isAG && this._skeleton == null)
            return;
        if (animName != null) {
            if (this._isAG) {
                if (!(animName instanceof AnimationGroup))
                    return;

                // console.log("masuk");
                anim.ag = animName;
                anim.exist = true;
                // console.log(anim.ag);
            }
            else {
                if (this._skeleton.getAnimationRange(anim.name) != null) {
                    anim.name = animName;
                    anim.exist = true;
                }
                else {
                    anim.exist = false;
                    return;
                }
            }
        }
        if (loop != null)
            anim.loop = loop;
        if (rate != null)
            anim.rate = rate;
    };

    enableBlending = function (n) {
        if (this._isAG) {
            var keys = Object.keys(this._actionMap);
            for (var _i = 0, keys_2 = keys; _i < keys_2.length; _i++) {
                var key = keys_2[_i];
                var act = this._actionMap[key];
                if (!(act instanceof ActionData))
                    continue;
                if (act.exist) {
                    var ar = act.ag;
                    for (var _a = 0, _b = ar.targetedAnimations; _a < _b.length; _a++) {
                        var ta = _b[_a];
                        ta.animation.enableBlending = true;
                        ta.animation.blendingSpeed = n;
                    }
                }
            }
        }
        else {
            if (this._skeleton !== null)
                this._skeleton.enableBlending(n);
        }
    };
    disableBlending = function () {
        if (this._isAG) {
            var keys = Object.keys(this._actionMap);
            for (var _i = 0, keys_3 = keys; _i < keys_3.length; _i++) {
                var key = keys_3[_i];
                var anim = this._actionMap[key];
                if (!(anim instanceof ActionData))
                    continue;
                if (anim.exist) {
                    var ar = anim.ag;
                    for (var _a = 0, _b = ar.targetedAnimations; _a < _b.length; _a++) {
                        var ta = _b[_a];
                        ta.animation.enableBlending = false;
                    }
                }
            }
        }
    };
    setWalkAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.walk, rangeName, rate, loop);
    };
    setRunAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.run, rangeName, rate, loop);
    };
    setWalkBackAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.walkBack, rangeName, rate, loop);
        this._copySlowAnims(this._actionMap.walkBackFast, this._actionMap.walkBack);
    };
    setWalkBackFastAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.walkBackFast, rangeName, rate, loop);
    };
    setSlideBackAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.slideBack, rangeName, rate, loop);
    };
    setIdleAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.idle, rangeName, rate, loop);
    };
    setTurnRightAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.turnRight, rangeName, rate, loop);
        this._copySlowAnims(this._actionMap.turnRightFast, this._actionMap.turnRight);
    };
    setTurnRightFastAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.turnRightFast, rangeName, rate, loop);
    };
    setTurnLeftAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.turnLeft, rangeName, rate, loop);
        this._copySlowAnims(this._actionMap.turnLeftFast, this._actionMap.turnLeft);
    };
    setTurnLeftFastAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.turnLeftFast, rangeName, rate, loop);
    };
    setStrafeRightAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.strafeRight, rangeName, rate, loop);
        this._copySlowAnims(this._actionMap.strafeRightFast, this._actionMap.strafeRight);
    };
    setStrafeRightFastAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.strafeRightFast, rangeName, rate, loop);
    };
    setStrafeLeftAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.strafeLeft, rangeName, rate, loop);
        this._copySlowAnims(this._actionMap.strafeLeftFast, this._actionMap.strafeLeft);
    };
    setStrafeLeftFastAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.strafeLeftFast, rangeName, rate, loop);
    };
    setIdleJumpAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.idleJump, rangeName, rate, loop);
    };
    setRunJumpAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.runJump, rangeName, rate, loop);
    };
    setFallAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.fall, rangeName, rate, loop);
    };
    setDancingAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.dancing, rangeName, rate, loop);
    };
    setHappyAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.happy, rangeName, rate, loop);
    };
    setHelloAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.hello, rangeName, rate, loop);
    };
    setSaluteAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.salute, rangeName, rate, loop);
    };
    setSittingAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.sitting, rangeName, rate, loop);
    };
    setSleepingAnim = function (rangeName, rate, loop) {
        this._setAnim(this._actionMap.sleeping, rangeName, rate, loop);
    };
    setWalkKey = function (key) {
        this._actionMap.walk.key = key.toLowerCase();
    };
    setWalkBackKey = function (key) {
        this._actionMap.walkBack.key = key.toLowerCase();
    };
    setTurnLeftKey = function (key) {
        this._actionMap.turnLeft.key = key.toLowerCase();
    };
    setTurnRightKey = function (key) {
        this._actionMap.turnRight.key = key.toLowerCase();
    };
    setStrafeLeftKey = function (key) {
        this._actionMap.strafeLeft.key = key.toLowerCase();
    };
    setStrafeRightKey = function (key) {
        this._actionMap.strafeRight.key = key.toLowerCase();
    };
    setJumpKey = function (key) {
        this._actionMap.idleJump.key = key.toLowerCase();
    };
    setCameraElasticity = function (b) {
        this._cameraElastic = b;
    };
    setCameraTarget = function (v) {
        this._cameraTarget.copyFrom(v);
    };
    cameraCollisionChanged = function () {
        this._savedCameraCollision = this._camera.checkCollisions;
    };
    setNoFirstPerson = function (b) {
        this._noFirstPerson = b;
    };
    _checkAnimRanges = function (skel) {
        var keys = Object.keys(this._actionMap);
        for (var _i = 0, keys_4 = keys; _i < keys_4.length; _i++) {
            var key = keys_4[_i];
            var anim = this._actionMap[key];
            if (!(anim instanceof ActionData))
                continue;
            if (skel != null) {
                if (skel.getAnimationRange(anim.id) != null) {
                    anim.name = anim.id;
                    anim.exist = true;
                    this._hasAnims = true;
                }
            }
            else {
                anim.exist = false;
            }
        }
        this._checkFastAnims();
    };
    _checkFastAnims = function () {
        this._copySlowAnims(this._actionMap.walkBackFast, this._actionMap.walkBack);
        this._copySlowAnims(this._actionMap.turnRightFast, this._actionMap.turnRight);
        this._copySlowAnims(this._actionMap.turnLeftFast, this._actionMap.turnLeft);
        this._copySlowAnims(this._actionMap.strafeRightFast, this._actionMap.strafeRight);
        this._copySlowAnims(this._actionMap.strafeLeftFast, this._actionMap.strafeLeft);
    };
    _copySlowAnims = function (f, s) {
        if (f.exist)
            return;
        if (!s.exist)
            return;
        f.exist = true;
        f.ag = s.ag;
        f.name = s.name;
        f.rate = s.rate * 2;
    };
    setMode = function (n) {
        this._mode = n;
        this._saveMode = n;
    };
    getMode = function () {
        return this._mode;
    };
    setTurningOff = function (b) {
        this._noRot = b;
    };
    isTurningOff = function () {
        return this._noRot;
    };
    _setRHS = function (mesh) {
        var meshMatrix = mesh.getWorldMatrix();
        var _localX = new Vector3.FromFloatArray(meshMatrix.m, 0);
        var _localY = new Vector3.FromFloatArray(meshMatrix.m, 4);
        var _localZ = new Vector3.FromFloatArray(meshMatrix.m, 8);
        var actualZ = new Vector3.Cross(_localX, _localY);
        if (new Vector3.Dot(actualZ, _localZ) < 0) {
            this._isRHS = true;
            this._signRHS = 1;
        }
        else {
            this._isRHS = false;
            this._signRHS = -1;
        }
    };
    setFaceForward = function (b) {
        this._ff = b;
        if (this._isRHS) {
            this._av2cam = b ? Math.PI / 2 : 3 * Math.PI / 2;
            this._ffSign = b ? 1 : -1;
        }
        else {
            this._av2cam = b ? 3 * Math.PI / 2 : Math.PI / 2;
            this._ffSign = b ? -1 : 1;
        }
    };
    isFaceForward = function () {
        return this._ff;
    };
    checkAGs = function (agMap) {
        var keys = Object.keys(this._actionMap);
        for (var _i = 0, keys_5 = keys; _i < keys_5.length; _i++) {
            var key = keys_5[_i];
            var anim = this._actionMap[key];
            if (!(anim instanceof ActionData))
                continue;
            if (agMap[anim.name] != null) {
                anim.ag = agMap[anim.name];
                anim.exist = true;
            }
        }
    };
    _containsAG = function (node, ags, fromRoot) {
        var r;
        var ns;
        if (fromRoot) {
            r = this._getRoot(node);
            ns = r.getChildren(function (n) { return (n instanceof TransformNode); }, false);
        }
        else {
            r = node;
            ns = [r];
        }
        for (var _i = 0, ags_1 = ags; _i < ags_1.length; _i++) {
            var ag = ags_1[_i];
            var tas = ag.targetedAnimations;
            for (var _a = 0, tas_1 = tas; _a < tas_1.length; _a++) {
                var ta = tas_1[_a];
                if (ns.indexOf(ta.target) > -1) {
                    return true;
                }
            }
        }
        return false;
    };
    _getRoot = function (tn) {
        if (tn.parent == null)
            return tn;
        return this._getRoot(tn.parent);
    };
    start = function () {
        if (this._started)
            return;
        this._started = true;
        this._act.reset();
        this._movFallTime = 0;
        this._idleFallTime = 0.001;
        this._grounded = false;
        this._updateTargetValue();
        this.enableKeyBoard(true);
        this._scene.registerBeforeRender(this._renderer);
    };
    stop = function () {
        if (!this._started)
            return;
        this._started = false;
        this._scene.unregisterBeforeRender(this._renderer);
        this.enableKeyBoard(false);
        this._prevAnim = null;
    };
    pauseAnim = function () {
        this._stopAnim = true;
    };
    resumeAnim = function () {
        this._stopAnim = false;
    };
    _isAvFacingCamera = function () {
        if (new Vector3.Dot(this._avatar.forward, this._avatar.position.subtract(this._camera.position)) < 0)
            return 1;
        else
            return -1;
    };
    _moveAVandCamera = function () {
        // console.log("move");
        this._avStartPos.copyFrom(this._avatar.position);
        var anim = null;
        var dt = this._scene.getEngine().getDeltaTime() / 1000;
        if (this._act._jump && !this._inFreeFall) {
            this._grounded = false;
            this._idleFallTime = 0;
            anim = this._doJump(dt);
        }
        else if (this.anyMovement() || this._inFreeFall) {
            this._grounded = false;
            this._idleFallTime = 0;
            anim = this._doMove(dt);
        }
        else if (this.anyBehaviours()) {
            anim = this._doBehaviours(dt);
        }
        else if (!this._inFreeFall && !this.anyBehaviours()) {
            anim = this._doIdle(dt);
        }

        // console.log(this._hasAnims);
        let self = this;
        if (!this._stopAnim && this._hasAnims && anim != null) {
            if (this._prevAnim !== anim) {
                if (anim.exist) {
                    if (this._isAG) {
                        // console.log(this._prevAnim);
                        if (this._prevAnim != null && this._prevAnim.exist)
                            this._prevAnim.ag.stop();
                        if (this.anyBehaviours()) {
                            anim.ag.onAnimationEndObservable.add(function () {
                                // console.log("anim stop");
                                self._act.reset();
                            });
                        }
                        anim.ag.start(anim.loop, anim.rate);


                    }
                    else {
                        this._skeleton.beginAnimation(anim.name, anim.loop, anim.rate);
                    }
                }
                this._prevAnim = anim;
            }
        }
        this._updateTargetValue();
        return;
    };
    _doJump = function (dt) {
        var anim = null;
        anim = this._actionMap.runJump;
        /* if (this._room !== undefined) {
            this._room.send("updateAnimation", {
                animstate: "jump"
            });
        } */
        this._shouldIdle = false;
        if (this._jumpTime === 0) {
            this._jumpStartPosY = this._avatar.position.y;
        }
        this._jumpTime = this._jumpTime + dt;
        var forwardDist = 0;
        var jumpDist = 0;
        var disp;
        if (this._mode != 1 && !this._noRot) {
            this._avatar.rotation.y = this._av2cam - this._camera.alpha;
        }

        if (this._wasRunning || this._wasWalking) {
            if (this._wasRunning) {
                forwardDist = this._actionMap.run.speed * dt;
            }
            else if (this._wasWalking) {
                forwardDist = this._actionMap.walk.speed * dt;
            }
            disp = this._moveVector.clone();
            disp.y = 0;
            disp = disp.normalize();
            disp.scaleToRef(forwardDist, disp);
            jumpDist = this._calcJumpDist(this._actionMap.runJump.speed, dt);
            disp.y = jumpDist;
        }
        else {
            jumpDist = this._calcJumpDist(this._actionMap.idleJump.speed, dt);
            disp = new Vector3(0, jumpDist, 0);
            anim = this._actionMap.idleJump;
            /* if (this._room !== undefined) {
                this._room.send("updateAnimation", {
                    animstate: "jump"
                });
            } */
            this._shouldIdle = false;
        }
        this._avatar.moveWithCollisions(disp);
        if (jumpDist < 0) {
            if ((this._avatar.position.y > this._avStartPos.y) || ((this._avatar.position.y === this._avStartPos.y) && (disp.length() > 0.001))) {
                this._endJump();
            }
            else if (this._avatar.position.y < this._jumpStartPosY) {
                var actDisp = this._avatar.position.subtract(this._avStartPos);
                if (!(this._areVectorsEqual(actDisp, disp, 0.001))) {
                    if (this._verticalSlope(actDisp) <= this._sl1) {
                        this._endJump();
                    }
                }
                else {
                    anim = this._actionMap.fall;
                    /* if (this._room !== undefined) {
                        this._room.send("updateAnimation", {
                            animstate: "fall"
                        });
                    } */
                    this._shouldIdle = false;
                }
            }
        }
        return anim;
    };
    _calcJumpDist = function (speed, dt) {
        var js = speed - this._gravity * this._jumpTime;
        var jumpDist = js * dt - 0.5 * this._gravity * dt * dt;
        return jumpDist;
    };
    _endJump = function () {
        this._act._jump = false;
        this._jumpTime = 0;
        this._wasWalking = false;
        this._wasRunning = false;
    };
    _areVectorsEqual = function (v1, v2, p) {
        return ((Math.abs(v1.x - v2.x) < p) && (Math.abs(v1.y - v2.y) < p) && (Math.abs(v1.z - v2.z) < p));
    };
    _verticalSlope = function (v) {
        return Math.atan(Math.abs(v.y / Math.sqrt(v.x * v.x + v.z * v.z)));
    };
    _doMove = function (dt) {
        var u = this._movFallTime * this._gravity;
        this._freeFallDist = u * dt + this._gravity * dt * dt / 2;
        this._movFallTime = this._movFallTime + dt;
        var moving = false;
        var anim = null;
        if (this._inFreeFall) {
            this._moveVector.y = -this._freeFallDist;
            moving = true;
        }
        else {
            this._wasWalking = false;
            this._wasRunning = false;
            var sign = void 0;
            var horizDist = 0;
            switch (true) {
                case (this._act._stepLeft):
                    sign = this._signRHS * this._isAvFacingCamera();
                    horizDist = this._actionMap.strafeLeft.speed * dt;
                    if (this._act._speedMod) {
                        horizDist = this._actionMap.strafeLeftFast.speed * dt;
                        anim = (-this._ffSign * sign > 0) ? this._actionMap.strafeLeftFast : this._actionMap.strafeRightFast;
                    }
                    else {
                        anim = (-this._ffSign * sign > 0) ? this._actionMap.strafeLeft : this._actionMap.strafeRight;
                    }
                    this._moveVector = this._avatar.calcMovePOV(sign * horizDist, -this._freeFallDist, 0);
                    moving = true;
                    break;
                case (this._act._stepRight):
                    sign = -this._signRHS * this._isAvFacingCamera();
                    horizDist = this._actionMap.strafeRight.speed * dt;
                    if (this._act._speedMod) {
                        horizDist = this._actionMap.strafeRightFast.speed * dt;
                        anim = (-this._ffSign * sign > 0) ? this._actionMap.strafeLeftFast : this._actionMap.strafeRightFast;
                    }
                    else {
                        anim = (-this._ffSign * sign > 0) ? this._actionMap.strafeLeft : this._actionMap.strafeRight;
                    }
                    this._moveVector = this._avatar.calcMovePOV(sign * horizDist, -this._freeFallDist, 0);
                    moving = true;
                    break;
                case (this._act._walk || (this._noRot && this._mode == 0)):
                    if (this._act._speedMod) {
                        this._wasRunning = true;
                        horizDist = this._actionMap.run.speed * dt;
                        anim = this._actionMap.run;
                        /* if (this._room !== undefined) {
                            this._room.send("updateAnimation", {
                                animstate: "run"
                            });
                        } */
                    }
                    else {
                        this._wasWalking = true;
                        horizDist = this._actionMap.walk.speed * dt;
                        anim = this._actionMap.walk;
                        /* if (this._room !== undefined) {
                            this._room.send("updateAnimation", {
                                animstate: "walk"
                            });
                        } */
                        this._shouldIdle = false;
                    }
                    this._moveVector = this._avatar.calcMovePOV(0, -this._freeFallDist, this._ffSign * horizDist);
                    moving = true;
                    break;
                case (this._act._walkback):
                    horizDist = this._actionMap.walkBack.speed * dt;
                    if (this._act._speedMod) {
                        horizDist = this._actionMap.walkBackFast.speed * dt;
                        anim = this._actionMap.walkBackFast;
                        /* if (this._room !== undefined) {
                            this._room.send("updateAnimation", {
                                animstate: "walkBack"
                            });
                        } */

                        this._shouldIdle = false;
                    }
                    else {
                        anim = this._actionMap.walkBack;
                        /* if (this._room !== undefined) {
                            this._room.send("updateAnimation", {
                                animstate: "walkBack"
                            });
                        } */
                        this._shouldIdle = false;
                    }
                    this._moveVector = this._avatar.calcMovePOV(0, -this._freeFallDist, -this._ffSign * horizDist);
                    moving = true;
                    break;
            }
        }
        if (!(this._noRot && this._mode == 0) && (!this._act._stepLeft && !this._act._stepRight) && (this._act._turnLeft || this._act._turnRight)) {
            var turnAngle = this._actionMap.turnLeft.speed * dt;
            if (this._act._speedMod) {
                turnAngle = 2 * turnAngle;
            }

            if (this._mode == 1) {
                if (!this._isTurning) {
                    this._sign = -this._ffSign * this._isAvFacingCamera();
                    if (this._isRHS)
                        this._sign = -this._sign;
                    this._isTurning = true;
                }
                var a = this._sign;
                if (this._act._turnLeft) {
                    if (this._act._walk) { }
                    else if (this._act._walkback)
                        a = -this._sign;
                    else {
                        anim = (this._sign > 0) ? this._actionMap.turnRight : this._actionMap.turnLeft;
                    }
                }
                else {
                    if (this._act._walk)
                        a = -this._sign;
                    else if (this._act._walkback) { }
                    else {
                        a = -this._sign;
                        anim = (this._sign > 0) ? this._actionMap.turnLeft : this._actionMap.turnRight;
                    }
                }
                this._avatar.rotation.y = this._avatar.rotation.y + turnAngle * a;
            } else {
                var a = 1;
                if (this._act._turnLeft) {
                    if (this._act._walkback)
                        a = -1;
                    if (!moving)
                        anim = this._actionMap.turnLeft;
                }
                else {
                    if (this._act._walk)
                        a = -1;
                    if (!moving) {
                        a = -1;
                        anim = this._actionMap.turnRight;
                    }
                }
                this._camera.alpha = this._camera.alpha + turnAngle * a;
            }
        }

        if (this._mode != 1) {
            if (this._noRot) {
                switch (true) {
                    case (this._act._walk && this._act._turnRight):
                        this._avatar.rotation.y = this._av2cam - this._camera.alpha + Math.PI / 4;
                        break;
                    case (this._act._walk && this._act._turnLeft):
                        this._avatar.rotation.y = this._av2cam - this._camera.alpha - Math.PI / 4;
                        break;
                    case (this._act._walkback && this._act._turnRight):
                        this._avatar.rotation.y = this._av2cam - this._camera.alpha + 3 * Math.PI / 4;
                        break;
                    case (this._act._walkback && this._act._turnLeft):
                        this._avatar.rotation.y = this._av2cam - this._camera.alpha - 3 * Math.PI / 4;
                        break;
                    case (this._act._walk):
                        this._avatar.rotation.y = this._av2cam - this._camera.alpha;
                        break;
                    case (this._act._walkback):
                        this._avatar.rotation.y = this._av2cam - this._camera.alpha + Math.PI;
                        break;
                    case (this._act._turnRight):
                        this._avatar.rotation.y = this._av2cam - this._camera.alpha + Math.PI / 2;
                        break;
                    case (this._act._turnLeft):
                        this._avatar.rotation.y = this._av2cam - this._camera.alpha - Math.PI / 2;
                        break;
                }
            }
            else {
                // // S for turning back
                // if(this._act._walkback)
                // {
                //     this._avatar.rotation.y = this._av2cam - this._camera.alpha + Math.PI;
                //     this._camera.alpha += 3;
                // }
                // else
                // {
                //     this._avatar.rotation.y = this._av2cam - this._camera.alpha;
                // }

                // S for walking back, need walking back animation
                this._avatar.rotation.y = this._av2cam - this._camera.alpha;
            }
        }

        if (moving) {
            // console.log(this._avatar.position.x, this._avatar.position.y, this._avatar.position.z);
            //update ke socket server        
            /* if (this._room !== undefined) {
                this._room.send("updatePosition", {
                    x: this._avatar.position.x,
                    y: this._avatar.position.y,
                    z: this._avatar.position.z,
                    rx: this._avatar.rotation.x,
                    ry: this._avatar.rotation.y,
                    rz: this._avatar.rotation.z
                });
            } */


            if (this._moveVector.length() > 0.001) {
                this._avatar.moveWithCollisions(this._moveVector);
                if (this._avatar.position.y > this._avStartPos.y) {
                    var actDisp = this._avatar.position.subtract(this._avStartPos);
                    var _slp = this._verticalSlope(actDisp);
                    if (_slp >= this._sl2) {
                        if (this._stepOffset > 0) {
                            if (this._vMoveTot == 0) {
                                this._vMovStartPos.copyFrom(this._avStartPos);
                            }
                            this._vMoveTot = this._vMoveTot + (this._avatar.position.y - this._avStartPos.y);
                            if (this._vMoveTot > this._stepOffset) {
                                this._vMoveTot = 0;
                                this._avatar.position.copyFrom(this._vMovStartPos);
                                this._endFreeFall();
                            }
                        }
                        else {
                            this._avatar.position.copyFrom(this._avStartPos);
                            this._endFreeFall();
                        }
                    }
                    else {
                        this._vMoveTot = 0;
                        if (_slp > this._sl1) {
                            this._fallFrameCount = 0;
                            this._inFreeFall = false;
                        }
                        else {
                            this._endFreeFall();
                        }
                    }
                }
                else if ((this._avatar.position.y) < this._avStartPos.y) {
                    var actDisp = this._avatar.position.subtract(this._avStartPos);
                    if (!(this._areVectorsEqual(actDisp, this._moveVector, 0.001))) {
                        if (this._verticalSlope(actDisp) <= this._sl1) {
                            this._endFreeFall();
                        }
                        else {
                            this._fallFrameCount = 0;
                            this._inFreeFall = false;
                        }
                    }
                    else {
                        this._inFreeFall = true;
                        this._fallFrameCount++;
                        if (this._fallFrameCount > this._fallFrameCountMin) {
                            anim = this._actionMap.fall;
                            /* if (this._room !== undefined) {
                                this._room.send("updateAnimation", {
                                    animstate: "fall"
                                });
                            } */
                            this._shouldIdle = false;
                        }
                    }
                }
                else {
                    this._endFreeFall();
                }
            }
        }
        return anim;
    };
    _endFreeFall = function () {
        this._movFallTime = 0;
        this._fallFrameCount = 0;
        this._inFreeFall = false;
    };
    _doIdle = function (dt) {
        if (this._grounded) {
            return this._actionMap.idle;
        }
        this._wasWalking = false;
        this._wasRunning = false;
        this._movFallTime = 0;
        var anim = this._actionMap.idle;
        if (!this._shouldIdle) {
            /* if (this._room !== undefined) {
                this._room.send("updateAnimation", {
                    animstate: "idle"
                });
            } */
            this._shouldIdle = true;
        }

        this._fallFrameCount = 0;
        if (dt === 0) {
            this._freeFallDist = 5;
        }
        else {
            var u = this._idleFallTime * this._gravity;
            this._freeFallDist = u * dt + this._gravity * dt * dt / 2;
            this._idleFallTime = this._idleFallTime + dt;
        }
        if (this._freeFallDist < 0.01)
            return anim;
        var disp = new Vector3(0, -this._freeFallDist, 0);
        if (this._mode != 1 && !this._noRot) {
            this._avatar.rotation.y = this._av2cam - this._camera.alpha;
        }

        this._avatar.moveWithCollisions(disp);
        if ((this._avatar.position.y > this._avStartPos.y) || (this._avatar.position.y === this._avStartPos.y)) {
            this._groundIt();
        }
        else if (this._avatar.position.y < this._avStartPos.y) {
            var actDisp = this._avatar.position.subtract(this._avStartPos);
            if (!(this._areVectorsEqual(actDisp, disp, 0.001))) {
                if (this._verticalSlope(actDisp) <= this._sl1) {
                    this._groundIt();
                    this._avatar.position.copyFrom(this._avStartPos);
                }
                else {
                    this._unGroundIt();
                    anim = this._actionMap.slideBack;
                }
            }
        }
        return anim;
    };
    _doBehaviours = function (dt) {
        var anim = null;
        switch (true) {
            case (this._act._dancing):
                anim = this._actionMap.dancing;
                /* if (this._room !== undefined) {
                    this._room.send("updateAnimation", {
                        animstate: "dancing"
                    });
                } */
                this._shouldIdle = false;
                break;
            case (this._act._happy):
                anim = this._actionMap.happy;
                /* if (this._room !== undefined) {
                    this._room.send("updateAnimation", {
                        animstate: "happy"
                    });
                } */
                this._shouldIdle = false;
                break;
            case (this._act._hello):
                anim = this._actionMap.hello;
                /* if (this._room !== undefined) {
                    this._room.send("updateAnimation", {
                        animstate: "hello"
                    });
                } */
                this._shouldIdle = false;
                break;
            case (this._act._salute):
                anim = this._actionMap.salute;
                /* if (this._room !== undefined) {
                    this._room.send("updateAnimation", {
                        animstate: "salute"
                    });
                } */
                this._shouldIdle = false;
                break;
            case (this._act._sitting):
                anim = this._actionMap.sitting;
                /* if (this._room !== undefined) {
                    this._room.send("updateAnimation", {
                        animstate: "sitting"
                    });
                } */
                this._shouldIdle = false;
                break;
            case (this._act._sleeping):
                anim = this._actionMap.sleeping;
                /* if (this._room !== undefined) {
                    this._room.send("updateAnimation", {
                        animstate: "sleeping"
                    });
                } */
                this._shouldIdle = false;
                break;
        }
        return anim;
    };
    _groundIt = function () {
        this._groundFrameCount++;
        if (this._groundFrameCount > this._groundFrameMax) {
            this._grounded = true;
            this._idleFallTime = 0;
        }
    };
    _unGroundIt = function () {
        this._grounded = false;
        this._groundFrameCount = 0;
    };
    _updateTargetValue = function () {
        if (this._vMoveTot == 0)
            this._avatar.position.addToRef(this._cameraTarget, this._camera.target);
        if (this._camera.radius > this._camera.lowerRadiusLimit) {
            if (this._cameraElastic)
                this._snapCamera();
        }
        if (this._camera.radius <= this._camera.lowerRadiusLimit) {
            if (!this._noFirstPerson && !this._inFP) {
                this._avatar.visibility = 0;
                this._camera.checkCollisions = false;
                this._saveMode = this._mode;
                this._mode = 0;
                this._inFP = true;
            }
        }
        else {
            this._inFP = false;
            this._mode = this._saveMode;
            this._avatar.visibility = 1;
            this._camera.checkCollisions = this._savedCameraCollision;
        }
    };
    _snapCamera = function () {
        var _this = this;
        this._camera.position.subtractToRef(this._camera.target, this._rayDir);
        this._ray.origin = this._camera.target;
        this._ray.length = this._rayDir.length();
        this._ray.direction = this._rayDir.normalize();
        var pi = this._scene.pickWithRay(this._ray, function (mesh) {
            if (mesh == _this._avatar || !mesh.checkCollisions)
                return false;
            else
                return true;
        }, true);
        if (pi.hit) {
            if (this._camera.checkCollisions) {
                var newPos = this._camera.target.subtract(pi.pickedPoint).normalize().scale(this._cameraSkin);
                pi.pickedPoint.addToRef(newPos, this._camera.position);
            }
            else {
                var nr = pi.pickedPoint.subtract(this._camera.target).length();
                this._camera.radius = nr - this._cameraSkin;
            }
        }
    };
    anyMovement = function () {
        return (this._act._walk || this._act._walkback || this._act._turnLeft || this._act._turnRight || this._act._stepLeft || this._act._stepRight);
    };
    anyBehaviours = function () {
        return (this._act._dancing || this._act._happy || this._act._hello || this._act._salute || this._act._sitting || this._act._sleeping);
    };
    resetBehaviours = function () {
        this._act._dancing = false;
        this._act._happy = false;
        this._act._hello = false;
        this._act._salute = false;
        this._act._sitting = false;
        this._act._sleeping = false;
    }
    _onKeyDown = function (e) {
        if (!e.key)
            return;
        if (e.repeat)
            return;
        switch (e.key.toLowerCase()) {
            case this._actionMap.idleJump.key:
                this._act._jump = true;
                break;
            case "capslock":
                this._act._speedMod = !this._act._speedMod;
                break;
            case "shift":
                this._act._speedMod = true;
                break;
            case "up":
            case "arrowup":
            case this._actionMap.walk.key:
                this._act._walk = true;
                // this._walkingSfx._loop = true
                // this._walkingSfx.play();
                break;
            case "left":
            case "arrowleft":
            case this._actionMap.turnLeft.key:
                this._act._turnLeft = true;
                break;
            case "right":
            case "arrowright":
            case this._actionMap.turnRight.key:
                this._act._turnRight = true;
                break;
            case "down":
            case "arrowdown":
            case this._actionMap.walkBack.key:
                this._act._walkback = true;
                break;
            case this._actionMap.dancing.key:
                this.resetBehaviours();
                this._act._dancing = true;
                break;
            case this._actionMap.happy.key:
                this.resetBehaviours();
                this._act._happy = true;
                break;
            case this._actionMap.hello.key:
                this.resetBehaviours();
                this._act._hello = true;
                break;
            case this._actionMap.salute.key:
                this.resetBehaviours();
                this._act._salute = true;
                break;
            case this._actionMap.sitting.key:
                this.resetBehaviours();
                this._act._sitting = true;
                break;
            case this._actionMap.sleeping.key:
                this.resetBehaviours();
                this._act._sleeping = true;
                break;
        }
        this._move = this.anyMovement();
    };
    _onKeyUp = function (e) {
        if (!e.key)
            return;
        switch (e.key.toLowerCase()) {
            case "shift":
                this._act._speedMod = false;
                break;
            case "up":
            case "arrowup":
            case this._actionMap.walk.key:
                this._act._walk = false;
                // this._walkingSfx.stop();
                // this._walkingSfx.isPlaying = false;
                break;
            case "left":
            case "arrowleft":
            case this._actionMap.turnLeft.key:
                this._act._turnLeft = false;
                this._isTurning = false;
                break;
            case "right":
            case "arrowright":
            case this._actionMap.turnRight.key:
                this._act._turnRight = false;
                this._isTurning = false;
                break;
            case "down":
            case "arrowdown":
            case this._actionMap.walkBack.key:
                this._act._walkback = false;
                break;
        }
        this._move = this.anyMovement();
    };
    enableKeyBoard = function (b) {
        this._ekb = b;
        var canvas = this._scene.getEngine().getRenderingCanvas();
        if (b) {
            canvas.addEventListener("keyup", this._handleKeyUp, false);
            canvas.addEventListener("keydown", this._handleKeyDown, false);
        }
        else {
            canvas.removeEventListener("keyup", this._handleKeyUp, false);
            canvas.removeEventListener("keydown", this._handleKeyDown, false);
        }
    };
    walk = function (b) {
        this._act._walk = b;
    };
    walkBack = function (b) {
        this._act._walkback = b;
    };
    walkBackFast = function (b) {
        this._act._walkback = b;
        this._act._speedMod = b;
    };
    run = function (b) {
        this._act._walk = b;
        this._act._speedMod = b;
    };
    turnLeft = function (b) {
        this._act._turnLeft = b;
        if (!b)
            this._isTurning = b;
    };
    turnLeftFast = function (b) {
        this._act._turnLeft = b;
        if (!b)
            this._isTurning = b;
        this._act._speedMod = b;
    };
    turnRight = function (b) {
        this._act._turnRight = b;
        if (!b)
            this._isTurning = b;
    };
    turnRightFast = function (b) {
        this._act._turnRight = b;
        if (!b)
            this._isTurning = b;
        this._act._speedMod = b;
    };
    strafeLeft = function (b) {
        this._act._stepLeft = b;
    };
    strafeLeftFast = function (b) {
        this._act._stepLeft = b;
        this._act._speedMod = b;
    };
    strafeRight = function (b) {
        this._act._stepRight = b;
    };
    strafeRightFast = function (b) {
        this._act._stepRight = b;
        this._act._speedMod = b;
    };
    jump = function () {
        this._act._jump = true;
    };
    idle = function () {
        this._act.reset();
    };
    setDancing = function () {
        this.resetBehaviours();
        this._act._dancing = true;
    };
    setHappy = function () {
        this.resetBehaviours();
        this._act._happy = true;
    };
    setHello = function () {
        this.resetBehaviours();
        this._act._hello = true;
    };
    setSalute = function () {
        this.resetBehaviours();
        this._act._salute = true;
    };
    setSitting = function () {
        this.resetBehaviours();
        this._act._sitting = true;
    };
    setSleeping = function () {
        this.resetBehaviours();
        this._act._sleeping = true;
    };
    setWalking = function () {
        this.resetBehaviours();
        this._act._walk = true;
    };
    isAg = function () {
        return this._isAG;
    };
    _findSkel = function (n) {
        var root = this._root(n);
        if (root instanceof Mesh && root.skeleton)
            return root.skeleton;
        var ms = root.getChildMeshes(false, function (cm) {
            if (cm instanceof Mesh) {
                if (cm.skeleton) {
                    return true;
                }
            }
            return false;
        });
        if (ms.length > 0)
            return ms[0].skeleton;
        else
            return null;
    };
    _root = function (tn) {
        if (tn.parent == null)
            return tn;
        return this._root(tn.parent);
    };
    setAvatar = function (avatar, faceForward) {
        if (faceForward === void 0) { faceForward = false; }
        var rootNode = this._root(avatar);
        if (rootNode instanceof Mesh) {
            this._avatar = rootNode;
        }
        else {
            console.error("Cannot move this mesh. The root node of the mesh provided is not a mesh");
            return false;
        }
        this._skeleton = this._findSkel(avatar);
        this._isAG = this._containsAG(avatar, this._scene.animationGroups, true);
        this._actionMap.reset();
        if (!this._isAG && this._skeleton != null)
            this._checkAnimRanges(this._skeleton);
        this._setRHS(avatar);
        this.setFaceForward(faceForward);
        return true;
    };
    getAvatar = function () {
        return this._avatar;
    };
    setAvatarSkeleton = function (skeleton) {
        this._skeleton = skeleton;
        if (this._skeleton != null && this._skeleton.overrideMesh)
            this._isAG = true;
        else
            this._isAG = false;
        if (!this._isAG && this._skeleton != null)
            this._checkAnimRanges(this._skeleton);
    };
    getSkeleton = function () {
        return this._skeleton;
    };

    setupConfig = function (myAgmap) {
        console.log("Setup character controller")
        /* if (this._room !== undefined) {
            this._room.send("updateName", {
                name: this._avatar.name
            });
        } */

        // switch false/true jika karakter bergerak terbalik
        this.setFaceForward(true);
        this.setMode(0);
        this.setTurnSpeed(45);
        //below makes the controller point the camera at the player head which is approx
        //1.5m above the player origin
        this.setCameraTarget(new Vector3(0, 1.5, -0.1));
        //if the camera comes close to the player we want to enter first person mode.
        this.setNoFirstPerson(false);
        //the height of steps which the player can climb
        this.setStepOffset(0.4);
        //the minimum and maximum slope the player can go up
        //between the two the player will start sliding down if it stops
        this.setSlopeLimit(30, 60);
        // console.log(animationGroups);
        this.setAnimationGroups(myAgmap);
        //tell controller
        // - which animation range should be used for which player animation
        // - rate at which to play that animation range
        // - wether the animation range should be looped
        //use this if name, rate or looping is different from default
        this.setIdleAnim(myAgmap["idle"], 1, true);
        this.setWalkAnim(myAgmap["walk"], 1, true);
        this.setWalkBackAnim(myAgmap["walk"], -1, true);
        this.setTurnLeftAnim(myAgmap["turnLeft"], 0.5, true);
        this.setTurnRightAnim(myAgmap["turnRight"], 0.5, true);
        this.setIdleJumpAnim(myAgmap["idleJump"], 3, false);
        this.setRunJumpAnim(myAgmap["runJump"], 3, false);
        this.setDancingAnim(myAgmap["dancing"], 1, false);
        this.setHappyAnim(myAgmap["happy"], 1, false);
        this.setHelloAnim(myAgmap["hello"], 1, false);
        this.setSaluteAnim(myAgmap["salute"], 1, false);
        this.setSittingAnim(myAgmap["sitting"], 1, false);
        this.setSleepingAnim(myAgmap["sleeping"], 1, false);
        // this.setFallAnim(myAgmap["fall"], 2, false);
        this.setTurningOff(false);
    }

    // return CharacterController;
};

var _Action = (function () {
    function _Action() {
        this._walk = false;
        this._walkback = false;
        this._turnRight = false;
        this._turnLeft = false;
        this._stepRight = false;
        this._stepLeft = false;
        this._jump = false;
        this._speedMod = false;
        this._dancing = false;
        this._happy = false;
        this._hello = false;
        this._salute = false;
        this._sitting = false;
        this._sleeping = false;

        this.reset();
    }
    _Action.prototype.reset = function () {
        this._walk = false;
        this._walkback = false;
        this._turnRight = false;
        this._turnLeft = false;
        this._stepRight = false;
        this._stepLeft = false;
        this._jump = false;
        this._speedMod = false;
        this._dancing = false;
        this._happy = false;
        this._hello = false;
        this._salute = false;
        this._sitting = false;
        this._sleeping = false;
    };
    return _Action;
}());
var ActionData = (function () {
    function ActionData(id, speed, key) {
        if (speed === void 0) { speed = 1; }
        this.name = "";
        this.loop = true;
        this.rate = 1;
        this.exist = false;
        this.id = id;
        this.speed = speed;
        this.ds = speed;
        this.key = key;
        this.dk = key;
    }
    ActionData.prototype.reset = function () {
        this.name = "";
        this.speed = this.ds;
        this.key = this.dk;
        this.loop = true;
        this.rate = 1;
        this.sound = "";
        this.exist = false;
    };
    return ActionData;
}());

var ActionMap = (function () {
    function ActionMap() {
        this.walk = new ActionData("walk", 3, "w");
        this.walkBack = new ActionData("walkBack", 1.5, "s");
        this.walkBackFast = new ActionData("walkBackFast", 3, "na");
        this.idle = new ActionData("idle", 0, "na");
        this.idleJump = new ActionData("idleJump", 6, " ");
        this.run = new ActionData("run", 6, "na");
        this.runJump = new ActionData("runJump", 6, "na");
        this.fall = new ActionData("fall", 0, "na");
        this.turnLeft = new ActionData("turnLeft", Math.PI / 8, "a");
        this.turnLeftFast = new ActionData("turnLeftFast", Math.PI / 4, "na");
        this.turnRight = new ActionData("turnRight", Math.PI / 8, "d");
        this.turnRightFast = new ActionData("turnRightFast", Math.PI / 4, "na");
        this.strafeLeft = new ActionData("strafeLeft", 1.5, "q");
        this.strafeLeftFast = new ActionData("strafeLeftFast", 3, "na");
        this.strafeRight = new ActionData("strafeRight", 1.5, "e");
        this.strafeRightFast = new ActionData("strafeRightFast", 3, "na");
        this.slideBack = new ActionData("slideBack", 0, "na");
        this.dancing = new ActionData("dancing", 0, "z");
        this.happy = new ActionData("happy", 0, "x");
        this.hello = new ActionData("hello", 0, "c");
        this.salute = new ActionData("salute", 0, "v");
        this.sitting = new ActionData("sitting", 0, "b");
        this.sleeping = new ActionData("sleeping", 0, "n");
    }
    ActionMap.prototype.reset = function () {
        var keys = Object.keys(this);
        for (var _i = 0, keys_6 = keys; _i < keys_6.length; _i++) {
            var key = keys_6[_i];
            var act = this[key];
            if (!(act instanceof ActionData))
                continue;
            act.reset();
        }
    };
    return ActionMap;
}());

;
var CCSettings = (function () {
    function CCSettings() {
        this.cameraElastic = true;
        this.cameraTarget = new Vector3.Zero();
        this.noFirstPerson = false;
        this.topDown = true;
        this.turningOff = true;
        this.keyboard = true;
    }
    return CCSettings;
}());