'use strict';

let gl;
let surface;
let shProgram;
let spaceball;
let canvas;
let InputCounter = 0.0;
let flag = false;
let InputH = 0.0;
let C = 3;
let f_u;
let a_uv;
let r_uv;
let scale = 1.0;
let AmbientColor = [0.0, 0.0, 0.0];
let DiffuseColor = [0.25, 0.06, 0.3];
let SpecularColor = [0.4, 0.24, 1.0];
let Shininess = 1.0;
let innerLimit = 5;
let outerLimit = 15;

let World_X = -1;
let World_Y = 0;
let World_Z = -10;



function deg2rad(angle) {
    return angle * Math.PI / 180;
}

// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function (vertices, normals) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STREAM_DRAW);

        this.count = vertices.length / 3;
    }

    this.Draw = function () {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iNormalVertex, 3, gl.FLOAT, true, 0, 0);
        gl.enableVertexAttribArray(shProgram.iNormalVertex);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
    }
}

// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iNormalVertex = -1;

    this.iModelViewProjectionMatrix = -1;
    this.iLightWorldPosition = -1;
    this.iWorldInverseTranspose = -1;

    this.iColor = -1;
    this.iAmbientColor = -1;
    this.iDiffuseColor = -1;
    this.iSpecularColor = -1;
    this.iShininess = -1;
    this.iInnerLimit = -1;
    this.iOuterLimit = -1;

    this.Use = function () {
        gl.useProgram(this.prog);
    }
}

function draw() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.enable(gl.CULL_FACE);

    // Enable the depth buffer
    gl.enable(gl.DEPTH_TEST);

    /* Set the values of the projection transformation */
    let projection = m4.perspective(scale, 1, 8, 12);

    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let WorldMatrix = m4.translation(World_X, World_Y, World_Z);
    let rotateToPointZero = m4.axisRotation([0.8, 0.0, 0], 1);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(WorldMatrix, matAccum0);
    let modelViewProjection = m4.multiply(projection, matAccum1);

    var worldInverseMatrix = m4.inverse(matAccum1);
    var worldInverseTransposeMatrix = m4.transpose(worldInverseMatrix);

    gl.uniform3fv(shProgram.iLightWorldPosition, LightCoordParabola());

    gl.uniformMatrix4fv(shProgram.iWorldInverseTranspose, false, worldInverseTransposeMatrix);
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);

    gl.uniform3fv(shProgram.iAmbientColor, AmbientColor);
    gl.uniform3fv(shProgram.iDiffuseColor, DiffuseColor);
    gl.uniform3fv(shProgram.iSpecularColor, SpecularColor);
    gl.uniform1f(shProgram.iShininess, Shininess);
    gl.uniform1f(shProgram.iInnerLimit, Math.cos(deg2rad(innerLimit)));
    gl.uniform1f(shProgram.iOuterLimit, Math.cos(deg2rad(outerLimit)));

    gl.uniform4fv(shProgram.iColor, [0.5, 0.5, 0.5, 1]);

    surface.Draw();
}

function CreateSurfaceData() {
    let step = 1.0;
    let DeltaU = 0.0001;
    let DeltaV = 0.0001;

    let vertexList = [];
    let normalsList = [];

    for (let u = -90; u < 90; u += step) {
        for (let v = 0; v < 180; v += step) {
            let unext = u + step;

            let xyz = CalcXYZ(u, v);

            vertexList.push(xyz[0], xyz[1], xyz[2]);

            let DerivativeU = CalcDerivativeU(u, v, DeltaU, xyz);
            let DerivativeV = CalcDerivativeV(u, v, DeltaV, xyz);

            let result = m4.cross(DerivativeV, DerivativeU);
            normalsList.push(result[0], result[1], result[2]);

            xyz = CalcXYZ(unext, v);
            vertexList.push(xyz[0], xyz[1], xyz[2]);

            DerivativeU = CalcDerivativeU(unext, v, DeltaU, xyz);
            DerivativeV = CalcDerivativeV(unext, v, DeltaV, xyz);

            result = m4.cross(DerivativeV, DerivativeU);
            normalsList.push(result[0], result[1], result[2]);
        }
    }

    return [vertexList, normalsList];
}

function CalcPar(uRad, vRad) {
    f_u = -deg2rad(uRad) / Math.sqrt(C + 1) + Math.atan(Math.sqrt(C + 1) * Math.tan(deg2rad(uRad)));
    a_uv = 2 / (C + 1 - C * Math.sin(deg2rad(vRad)) * Math.sin(deg2rad(vRad)) * Math.cos(deg2rad(uRad)) * Math.cos(deg2rad(uRad)));
    r_uv = (a_uv / Math.sqrt(C)) * Math.sqrt((C + 1) * (1 + C * Math.sin(deg2rad(uRad)) * Math.sin(deg2rad(uRad)))) * Math.sin(deg2rad(vRad));
    return [f_u, a_uv, r_uv];
}

function CalcXYZ(u, v) {
    let CalcParData = CalcPar(u, v);
    return [CalcParData[2] * Math.cos(CalcParData[0]), CalcParData[2] * Math.sin(CalcParData[0]), (Math.log(deg2rad(v) / 2) + a_uv * (C + 1) * Math.cos(deg2rad(v))) / Math.sqrt(C)];
}

function CalcDerivativeU(u, v, DeltaU, xyz) {
    let Dxyz = CalcXYZ(u + DeltaU, v);

    let Dxdu = (Dxyz[0] - xyz[0]) / deg2rad(DeltaU);
    let Dydu = (Dxyz[1] - xyz[1]) / deg2rad(DeltaU);
    let Dzdu = (Dxyz[2] - xyz[2]) / deg2rad(DeltaU);

    return [Dxdu, Dydu, Dzdu];
}

function CalcDerivativeV(u, v, DeltaV, xyz) {
    let Dxyz = CalcXYZ(u, v + DeltaV);

    let Dxdv = (Dxyz[0] - xyz[0]) / deg2rad(DeltaV);
    let Dydv = (Dxyz[1] - xyz[1]) / deg2rad(DeltaV);
    let Dzdv = (Dxyz[2] - xyz[2]) / deg2rad(DeltaV);

    return [Dxdv, Dydv, Dzdv];
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iNormalVertex = gl.getAttribLocation(prog, "normal");

    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iLightWorldPosition = gl.getUniformLocation(prog, "LightWorldPosition");
    shProgram.iWorldInverseTranspose = gl.getUniformLocation(prog, "WorldInverseTranspose");


    shProgram.iColor = gl.getUniformLocation(prog, "color");
    shProgram.iAmbientColor = gl.getUniformLocation(prog, "ambientColor");
    shProgram.iDiffuseColor = gl.getUniformLocation(prog, "diffuseColor");
    shProgram.iSpecularColor = gl.getUniformLocation(prog, "specularColor");
    shProgram.iShininess = gl.getUniformLocation(prog, "shininess");
    shProgram.iInnerLimit = gl.getUniformLocation(prog, "u_innerLimit");
    shProgram.iOuterLimit = gl.getUniformLocation(prog, "u_outerLimit");

    surface = new Model('Surface');
    let SurfaceData = CreateSurfaceData();
    surface.BufferData(SurfaceData[0], SurfaceData[1]);

}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    // Canvas
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }

    // GL
    try {
        initGL(); // initialize the WebGL graphics context
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);
    canvas.onmousewheel = function (event) {
        if (+(scale - (Math.round(event.wheelDelta / 150) / 10.0)).toFixed(1) < 0.0 || +(scale - (Math.round(event.wheelDelta / 150) / 10.0)).toFixed(1) > 2.0) {
            return false;
        }
        scale -= ((event.wheelDelta / 150) / 10.0);
        document.getElementById("scale").value = +scale.toFixed(1);
        document.getElementById("scale_text").innerHTML = +scale.toFixed(1);
        draw();
        return false;
    };

    draw();

}

window.addEventListener("keydown", function (event) {
    switch (event.key) {
        case "ArrowLeft":
            if (InputCounter > -1) {
                InputCounter -= 0.05;
            }
            draw();
            break;
        case "ArrowRight":
            if (InputCounter < 1) {
                InputCounter += 0.05;
            }
            draw();
            break;
        case "ArrowDown":
            if (InputH > -3) {
                InputH -= 0.1;
            }
            draw();
            break;
        case "ArrowUp":
            if (InputH < 3) {
                InputH += 0.1;
            }
            draw();
            break;
        case "+":
            if (Shininess < 10) {
                Shininess += 1;
            }
            draw();
            document.getElementById("Shininess").value = Shininess;
            document.getElementById("Shininess_text").innerHTML = Shininess;
            break;
        case "-":
            if (Shininess > -10) {
                Shininess -= 1;
            }
            draw();
            document.getElementById("Shininess").value = Shininess;
            document.getElementById("Shininess_text").innerHTML = Shininess;
            break;
        default:
            return;

    }
});

function LightCoordParabola() {
    let cord = Math.sin(InputCounter) * 1.2;
    return [cord, InputH, (cord)];
}

function DrawParabola_right() {
    if (flag) {
        if (InputCounter < 1) {
            InputCounter += 0.05
        } else {
            DrawParabola_left();
            return;
        }
        draw();
        setTimeout(DrawParabola_right, 50);
    }
}

function DrawParabola_left() {
    if (flag) {
        if (InputCounter > -1) {
            InputCounter -= 0.05
        } else {
            DrawParabola_right();
            return;
        }
        draw();
        setTimeout(DrawParabola_left, 50);
    }
}
