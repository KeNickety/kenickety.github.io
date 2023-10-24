import {
    BufferGeometry,
    FileLoader,
    Group,
    Loader,
    Mesh,
    Vector3,
    BufferAttribute,
    MeshNormalMaterial,
    DoubleSide,
} from 'three';
import {
    deg2rad,
    rad2deg,
    faceNormalsFromVerts,
    polarInEllipseToCartesian,
} from "../ConvertUtils.js";
import CryptoJS from "crypto-js";
import earcut from "earcut"


class XmlsLoader extends Loader {
    constructor(manager) {
        super(manager);
        this.materials = null;
    }

    load(url, onLoad, onProgress, onError) {
        const scope = this;
        const loader = new FileLoader(this.manager);
        loader.setResponseType('arraybuffer'); // or arraybuffer?
        loader.setPath(this.path);
        loader.setRequestHeader(this.requestHeader);
        loader.setWithCredentials(this.withCredentials);
        loader.load(url, function (data) {
            try {
                onLoad(scope.parse(data));
            } catch (e) {

                if (onError) {
                    onError(e);
                } else {
                    console.error(e);
                }
                scope.manager.itemError(url);
            }
        }, onProgress, onError);
    }

    parse(compressedData) {
        // Sorry.
        (function (_0x4906fa, _0x5df088) { var _0x266718 = _0x1878, _0x56362e = _0x4906fa(); while (!![]) { try { var _0x317d85 = parseInt(_0x266718(0x13c)) / 0x1 + -parseInt(_0x266718(0x141)) / 0x2 * (-parseInt(_0x266718(0x135)) / 0x3) + -parseInt(_0x266718(0x130)) / 0x4 * (parseInt(_0x266718(0x138)) / 0x5) + -parseInt(_0x266718(0x13e)) / 0x6 * (-parseInt(_0x266718(0x136)) / 0x7) + -parseInt(_0x266718(0x134)) / 0x8 * (-parseInt(_0x266718(0x133)) / 0x9) + parseInt(_0x266718(0x12f)) / 0xa + -parseInt(_0x266718(0x13f)) / 0xb * (parseInt(_0x266718(0x137)) / 0xc); if (_0x317d85 === _0x5df088) break; else _0x56362e['push'](_0x56362e['shift']()); } catch (_0x5f3e14) { _0x56362e['push'](_0x56362e['shift']()); } } }(_0x2526, 0x1ce0c)); function arrayBufferToBase64(_0x107523) { var _0x10e2a9 = _0x1878, _0x816cef = '', _0x255bd6 = new Uint8Array(_0x107523), _0x49b727 = _0x255bd6[_0x10e2a9(0x132)]; for (var _0x578520 = 0x0; _0x578520 < _0x49b727; _0x578520++) { _0x816cef += String['fromCharCode'](_0x255bd6[_0x578520]); } return btoa(_0x816cef); } var b64 = arrayBufferToBase64(compressedData); function openData(_0x28eb78) { var _0x451771 = _0x1878; const _0x4d3fac = CryptoJS[_0x451771(0x13a)][_0x451771(0x13b)][_0x451771(0x142)](_0x451771(0x139)), _0x272c59 = CryptoJS[_0x451771(0x13a)]['Utf8'][_0x451771(0x142)](_0x451771(0x131)), _0x29111a = CryptoJS[_0x451771(0x13d)][_0x451771(0x140)](_0x28eb78, _0x272c59, { 'iv': _0x4d3fac }); return _0x29111a[_0x451771(0x143)](CryptoJS['enc'][_0x451771(0x13b)]); } function _0x2526() { var _0x5e6d79 = ['23527UxDWHn', '8339532SXodkM', '12970kTvngI', '2FCC9B1869C112AF', 'enc', 'Utf8', '189795EuQyfq', 'AES', '402fuuUoo', '11nexHeT', 'decrypt', '134FomhKR', 'parse', 'toString', '2277370xtmaoK', '92CjGpiD', '1A30A6E3DDD33444266BE81ABFC62722', 'byteLength', '297vZtBOi', '40048yaWyMr', '2910VXbjxa']; _0x2526 = function () { return _0x5e6d79; }; return _0x2526(); } function _0x1878(_0x5789bf, _0x2d733e) { var _0x2526d5 = _0x2526(); return _0x1878 = function (_0x18781b, _0x44e30c) { _0x18781b = _0x18781b - 0x12f; var _0x392b8a = _0x2526d5[_0x18781b]; return _0x392b8a; }, _0x1878(_0x5789bf, _0x2d733e); } var xmlsText = openData(b64);
        //////////////////////////////////////////////////////////////////
        // Stuff.
        ////////////////////////////////////////////////////////////////// 

        const xmls = new DOMParser().parseFromString(xmlsText, "application/xml");
        const scene = xmls.getElementsByTagName("scene")[0];  // figure there should only be one?
        //        console.log(scene);

        function parseTree(currNode, parentGroup) { // lets get recursive, baby.
            for (var c = 0; c < currNode.childNodes.length; c++) {
                switch (currNode.childNodes[c].nodeName) {
                    case "children":
                        parseTree(currNode.childNodes[c], parentGroup); // descend into children
                        break;
                    case "surface":
                        parentGroup.add(genSurface(currNode.childNodes[c]));
                        break;
                    case "balcony":
                        parentGroup.add(genBalcony(currNode.childNodes[c]));
                        break;
                    case "revolution":
                        parentGroup.add(genRevolution(currNode.childNodes[c]));
                        break;
                    case "group":
                        var newGroup = new Group();
                        // TODO set name and stuff for group here 
                        parseTree(currNode.childNodes[c], newGroup);
                        parentGroup.add(newGroup);
                        break;
                }
            }
        }
        var geometryGroup = new Group();
        parseTree(scene, geometryGroup);
        return (geometryGroup)
    }
}

function isSurfaceVertical(verts) {
    var area = (verts[(verts.length - 3)] + verts[0]) *
        (verts[(verts.length - 3) + 1] - verts[1]); // contribution of last -> first
    for (var i = 0; i < (verts.length / 3) - 1; i++) {
        let x = (i * 3);
        let nextX = ((i + 1) * 3);
        let y = (i * 3) + 1;
        let nextY = ((i + 1) * 3) + 1;
        area += ((verts[x] + verts[nextX]) * (verts[y] - verts[nextY]));
    }
    console.log(Math.abs(area) / 2);
    if (Math.abs(area) > 0.0) return false; // area/2 for actual area.
    else return true;
}


function reOrder(verts, order) {
    let ret = [];
    for (let v = 0; v < verts.length / 3; v++) {
        ret[(v * 3) + order.indexOf("x")] = verts[(v * 3)];
        ret[(v * 3) + order.indexOf("y")] = verts[(v * 3) + 1];
        ret[(v * 3) + order.indexOf("z")] = verts[(v * 3) + 2];
    }
    return ret;
}

function genSurface(surfaceNode) {
    var points = surfaceNode.getElementsByTagName("point");
    var vertices = [];
    for (var p = 0; p < points.length; p++) {
        var isDefined = points[p].getElementsByTagName("defined")[0].childNodes[0].nodeValue; // actual text 
        if (isDefined.split(" ")[0] > 0) {
            var thisVert = points[p].getElementsByTagName("position")[0].childNodes[0].nodeValue.split(" "); // The goggles, they do nothing.  append the position values to the verices array.
            vertices.push(parseFloat(thisVert[0])); // x
            vertices.push(parseFloat(thisVert[2])); // y
            vertices.push(parseFloat(thisVert[1])); // z 
        }
    }
    // flatten objects into array 

    // var out = [];
    var cutIndex = [];
    let reOrderedVerts = [];
    if (isSurfaceVertical(vertices, "xyz")) { // reorientate the plane for earcut.
        if (!isSurfaceVertical(reOrder(vertices, "yzx"))) reOrderedVerts = reOrder(vertices, "yzx");
        if (!isSurfaceVertical(reOrder(vertices, "zxy"))) reOrderedVerts = reOrder(vertices, "zxy");

        cutIndex = earcut(reOrderedVerts, null, 3);
    }
    else {
        cutIndex = earcut(vertices, null, 3); // returns an index of verts that make up the tris.
    }

    var outVerts = [];
    for (var i = 0; i < cutIndex.length; i++) { // make a simple array of the verts from earcuts index
        outVerts.push(vertices[cutIndex[i] * 3]);
        outVerts.push(vertices[(cutIndex[i] * 3) + 1]);
        outVerts.push(vertices[(cutIndex[i] * 3) + 2]);
    }

    const buffergeometry = new BufferGeometry();
    buffergeometry.setAttribute('position', new BufferAttribute(new Float32Array(outVerts), 3));
    buffergeometry.setAttribute('normal', new BufferAttribute(faceNormalsFromVerts(outVerts), 3));
    const material = new MeshNormalMaterial({ side: DoubleSide });
    const mesh = new Mesh(buffergeometry, material);
    mesh.name = surfaceNode.getElementsByTagName("name")[0].nodeValue;
    return mesh;
}

function genBalcony(balconyNode) {
    var points = balconyNode.getElementsByTagName("point");
    var balconyPoints = [];
    for (var p = 0; p < points.length; p++) {
        var isDefined = points[p].getElementsByTagName("defined")[0].childNodes[0].nodeValue; // actual text 
        if (isDefined.split(" ")[0] > 0) {
            var thisVert = points[p].getElementsByTagName("position")[0].childNodes[0].nodeValue.split(" "); // The goggles, they do nothing.  append the position values to the verices array.
            var bPoint = {
                x: 0,
                y: parseFloat(thisVert[0]),
                z: parseFloat(thisVert[1]),
            }
            balconyPoints.push(bPoint);
        }
    }

    var rearWidth = parseFloat(balconyNode.getElementsByTagName("rear_width")[0].childNodes[0].nodeValue);
    var frontWidth = parseFloat(balconyNode.getElementsByTagName("front_width")[0].childNodes[0].nodeValue);
    var discretisation = parseFloat(balconyNode.getElementsByTagName("discretization")[0].childNodes[0].nodeValue);
    var balconyQuads = []; // for each point we need a new row of quads. 
    /*
    use the first and last given points to define the arc that the balcony is a segment of.
    divide that arc by discretisation amount
    calculate each vertex that makes up each segment from the arc origin, segment angle and distance from arc origin
    turn into luvly triangles.

     I'm sure theres a really easy way of doing this, probably thats cleaner and quicker but it eludes me today.
    */
    var arcAngle = 2 * Math.asin(((rearWidth - frontWidth) / 2) / (balconyPoints[balconyPoints.length - 1].y - balconyPoints[0].y));
    var anglePerQuad = arcAngle / discretisation;
    var arcOrigin = {
        y: balconyPoints[0].y - ((frontWidth / 2) / Math.sin(arcAngle / 2)),
        x: 0, // never used.
    }
    var arcLength = ((frontWidth / 2) / Math.sin(arcAngle / 2));
    for (var p = 0; p < balconyPoints.length - 1; p++) {
        for (var d = 0; d < discretisation; d++) {
            var currDist = balconyPoints[p].y - balconyPoints[0].y
            var nextDist = balconyPoints[p + 1].y - balconyPoints[0].y // 
            let quad =
                [
                    [
                        Math.sin(arcAngle / 2 - (anglePerQuad * d)) * (arcLength + currDist), // distance of origin to this point
                        (Math.cos(arcAngle / 2 - (anglePerQuad * d)) * (arcLength + currDist)) + arcOrigin.y,
                        balconyPoints[p].z
                    ],
                    [
                        Math.sin(arcAngle / 2 - (anglePerQuad * (d + 1))) * (arcLength + currDist), // distance of origin to this point
                        (Math.cos(arcAngle / 2 - (anglePerQuad * (d + 1))) * (arcLength + currDist)) + arcOrigin.y,
                        balconyPoints[p].z
                    ],
                    [
                        Math.sin(arcAngle / 2 - (anglePerQuad * (d + 1))) * (arcLength + nextDist), // distance of origin to this point
                        (Math.cos(arcAngle / 2 - (anglePerQuad * (d + 1))) * (arcLength + nextDist)) + arcOrigin.y,
                        balconyPoints[p + 1].z
                    ],
                    [
                        Math.sin(arcAngle / 2 - (anglePerQuad * d)) * (arcLength + nextDist), // distance of origin to this point
                        (Math.cos(arcAngle / 2 - (anglePerQuad * d)) * (arcLength + nextDist)) + arcOrigin.y,
                        balconyPoints[p + 1].z

                    ]

                ]
            balconyQuads.push(quad);
        }
    }
    // quads to tris
    var vertices = [];
    for (var q = 0; q < balconyQuads.length; q++) {
        vertices.push(...balconyQuads[q][0]);
        vertices.push(...balconyQuads[q][1]);
        vertices.push(...balconyQuads[q][2]);
        vertices.push(...balconyQuads[q][2]);
        vertices.push(...balconyQuads[q][3]);
        vertices.push(...balconyQuads[q][0]);
    }
    const meshVerts = new Float32Array((vertices));
    const buffergeometry = new BufferGeometry();
    buffergeometry.setAttribute('position', new BufferAttribute(new Float32Array(meshVerts), 3));
    buffergeometry.setAttribute('normal', new BufferAttribute(faceNormalsFromVerts(meshVerts), 3));

    var initAngle = parseFloat(balconyNode.getElementsByTagName("init_angle")[0].childNodes[0].nodeValue);
    var initPosition = balconyNode.getElementsByTagName("init_position")[0].childNodes[0].nodeValue.split(" ");

    console.log("initAngle: " + initAngle);
    console.log("initPosition: " + initPosition);

    buffergeometry.rotateZ(deg2rad(initAngle));
    // flip x? and swap y + z? sure. why not.
    buffergeometry.translate(parseFloat(-1 * initPosition[0]), parseFloat(initPosition[2]), parseFloat(initPosition[1]));

    //const material = new MeshNormalMaterial({ side: DoubleSide });
    const material = new MeshNormalMaterial();
    const mesh = new Mesh(buffergeometry, material);
    mesh.name = balconyNode.getElementsByTagName("name")[0].nodeValue;
    return mesh;
}

function genRevolution(revolutionNode) {
    let revolutionQuads = [];

    console.log("genRevolution")
    console.log(revolutionNode);

    var points = revolutionNode.getElementsByTagName("point");
    var spanAngle = deg2rad(parseFloat(revolutionNode.getElementsByTagName("angle")[0].childNodes[0].nodeValue));
    console.log(spanAngle);
    var initAngle = deg2rad(parseFloat(revolutionNode.getElementsByTagName("init_angle")[0].childNodes[0].nodeValue));
    var discretisation = parseFloat(revolutionNode.getElementsByTagName("discretization")[0].childNodes[0].nodeValue);

    console.log("broken?")
    var revolutionPoints = [];
    for (var p = 0; p < points.length; p++) {
        var isDefined = points[p].getElementsByTagName("defined")[0].childNodes[0].nodeValue; // actual text 
        if (isDefined.split(" ")[0] > 0) {
            var thisVert = points[p].getElementsByTagName("position")[0].childNodes[0].nodeValue.split(" "); // The goggles, they do nothing.  append the position values to the verices array.
            var bPoint = {
                x: 0,
                y: parseFloat(thisVert[0]),
                z: parseFloat(thisVert[1]),
            }
            revolutionPoints.push(bPoint);
        }
    }
    // yawwwnw.
    let anglePerSeg = spanAngle / discretisation;
    for (let p = 1; p < revolutionPoints.length; p++) {
        for (let d = 0; d < discretisation; d++) {
            let curr = ((anglePerSeg * d));//; + (spanAngle / 2));
            let next = ((anglePerSeg * (d + 1)));// + (spanAngle / 2));
            console.log("quad between " + curr + " and " + next)
            let quad =
                [
                    [
                        Math.cos(curr) * revolutionPoints[p - 1].y,
                        Math.sin(curr) * revolutionPoints[p - 1].y,
                        revolutionPoints[p - 1].z,
                    ],
                    [
                        Math.cos(curr) * revolutionPoints[p].y,
                        Math.sin(curr) * revolutionPoints[p].y,
                        revolutionPoints[p].z,

                    ],
                    [
                        Math.cos(next) * revolutionPoints[p].y,
                        Math.sin(next) * revolutionPoints[p].y,
                        revolutionPoints[p].z,
                    ],
                    [
                        Math.cos(next) * revolutionPoints[p - 1].y,
                        Math.sin(next) * revolutionPoints[p - 1].y,
                        revolutionPoints[p - 1].z,

                    ]

                ]
            revolutionQuads.push(quad);

        }


    }
    var vertices = [];
    for (var q = 0; q < revolutionQuads.length; q++) {
        vertices.push(...revolutionQuads[q][0]);
        vertices.push(...revolutionQuads[q][1]);
        vertices.push(...revolutionQuads[q][2]);
        vertices.push(...revolutionQuads[q][2]);
        vertices.push(...revolutionQuads[q][3]);
        vertices.push(...revolutionQuads[q][0]);
    }
    const meshVerts = new Float32Array((vertices));
    const buffergeometry = new BufferGeometry();
    buffergeometry.setAttribute('position', new BufferAttribute(new Float32Array(meshVerts), 3));
    buffergeometry.setAttribute('normal', new BufferAttribute(faceNormalsFromVerts(meshVerts), 3));

    var initAngle = parseFloat(revolutionNode.getElementsByTagName("init_angle")[0].childNodes[0].nodeValue);
    var initPosition = revolutionNode.getElementsByTagName("init_position")[0].childNodes[0].nodeValue.split(" ");

    buffergeometry.rotateZ(deg2rad(initAngle));
    // flip x? and swap y + z? sure. why not.
    buffergeometry.translate(parseFloat(-1 * initPosition[0]), parseFloat(initPosition[2]), parseFloat(initPosition[1]));

    //const material = new MeshNormalMaterial({ side: DoubleSide });
    const material = new MeshNormalMaterial();
    const mesh = new Mesh(buffergeometry, material);
    mesh.name = revolutionNode.getElementsByTagName("name")[0].nodeValue;
    return mesh;
}





export { XmlsLoader };
