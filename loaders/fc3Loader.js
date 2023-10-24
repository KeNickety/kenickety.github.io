import {
    BufferGeometry,
    FileLoader,
    Group,
    Loader,
    Mesh,
    Vector2,
    BufferAttribute,
    MeshNormalMaterial,
    DoubleSide
} from 'three';
import { ungzip } from 'pako';
import {
    deg2rad,
    rad2deg,
    faceNormalsFromVerts,
    polarInEllipseToCartesian
} from "../ConvertUtils.js"


class Fc3Loader extends Loader {
    constructor(manager) {
        super(manager);
        this.materials = null;
    }

    load(url, onLoad, onProgress, onError) {
        const scope = this;
        const loader = new FileLoader(this.manager);
        loader.setResponseType('arraybuffer');
        loader.setPath(this.path);
        loader.setRequestHeader(this.requestHeader);
        loader.setWithCredentials(this.withCredentials);
        loader.load(url, function (text) {
            try {
                onLoad(scope.parse(text));
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
    ///////////////////////////////////////////////////////////
    // bufferToStream(arrayBuffer) {
    //     return new ReadableStream({
    //         start(controller) {
    //             controller.enqueue(arrayBuffer);
    //             controller.close();
    //         }
    //     });
    // }
    ///////////////////////////////////////////////////////////
    parse(compressedData) {

        let buff = new Uint8Array(compressedData);
        const signature = [0x1f, 0x8b, 0x08, 0x00, 0x00]; // gzip magic number, deflate, some zeros.
        let offset = findOffset(buff, signature); // find offset into file for magic number
        let result = ungzip(buff.slice(offset), { "to": "string" }); // ungzip from offset

        const easeXML = new DOMParser().parseFromString(result, "application/xml");
        var easeKeys = easeXML.getElementsByTagName('Keys')[0];
        var easeValues = easeXML.getElementsByTagName('Values')[0];
        var keysRef = easeKeys.getAttribute("href").slice(1);
        var valuesRef = easeValues.getAttribute("href").slice(1);

        var keys = [];
        const keyElements = easeXML.getElementById(keysRef);
        for (const child of keyElements.children) {
            keys.push(child.innerHTML);
        }
        var values = [];
        const valueElements = easeXML.getElementById(valuesRef);
        for (const child of valueElements.children) {
            values.push(child.innerHTML);
        }

        function createObjects(parent, chainArray, value) {
            if (chainArray.length == 1) {
                parent[chainArray[0]] = value;
                return parent;
            }
            else {
                parent[chainArray[0]] = parent[chainArray[0]] || {};
                return createObjects(parent[chainArray[0]], chainArray.slice(1, chainArray.length), value);
            }
        }

        var objectified = {};
        for (var i = 0, l = keys.length; i < l; i++) {
            createObjects(objectified, keys[i].split('.'), values[i]);
        }

        // we've finally built an object. 
        // time to do stuff with it. /////////////////////////////////////////
        const geometryGroup = new Group();

        let projectOrigin = {
            x: parseFloat(objectified.Project.Origin.X),
            y: parseFloat(objectified.Project.Origin.Y)
        };

        for (const [zone, zoneValue] of Object.entries(objectified.Project.AudienceZoneManager)) {
            if (zone.slice(0, 5) == "Zone[") {
                // get the zone properties

                /// *Screaming noises intensify*
                // ease considers the origin of the element to be the center. (at least with rectangles)
                let xOrigin = parseFloat(zoneValue.X) - projectOrigin.x;
                let yOrigin = parseFloat(zoneValue.Y) - projectOrigin.y;
                let currOrigin = new Vector2((
                    parseFloat(zoneValue.X) - projectOrigin.x),
                    parseFloat(zoneValue.Y) - projectOrigin.y
                );

                for (const [area, areaValue] of Object.entries(zoneValue)) {
                    if (area.slice(0, 5) == "Area[") {
                        // var roomObject = doc.createElement("RoomObject");
                        if (zoneValue.Type == "") {  // WHY is this sometimes not defined???
                            if (zoneValue.Width != undefined) zoneValue.Type = "Rectangle";
                            if (zoneValue.Radius != undefined) zoneValue.Type = "Arc";
                            if (zoneValue.FrontEdge != undefined) zoneValue.Type = "Trapezoid";
                            if (zoneValue.RightAngleLeft != undefined) zoneValue.Type = "Right Trapezoid"; // order is relevant..
                        }
                        switch (zoneValue.Type) {
                            case "Annulus":
                                geometryGroup.add(genArcSec(zoneValue, areaValue, currOrigin));
                                break;
                            case "Arc":
                                geometryGroup.add(genArcSec(zoneValue, areaValue, currOrigin));
                                break;
                            case "Right Trapezoid":
                                geometryGroup.add(genRightTrapezoid(zoneValue, areaValue, currOrigin));
                                break;
                            case "Trapezoid":
                                geometryGroup.add(genTrapezoid(zoneValue, areaValue, currOrigin));
                                break;
                            case "Rectangle":
                                geometryGroup.add(genRectangle(zoneValue, areaValue, currOrigin));
                                break;
                            default:
                        }
                    }
                }

            }
        }
        return geometryGroup;
    }
}


function genArcSec(zoneValue, areaValue, currOrigin) {
    // we only do circles (!)
    var inner, outer, innerN, outerN;
    inner = (parseFloat(zoneValue.InnerRadius) || 0) + parseFloat(areaValue.D1);  // inner size in x
    outer = (parseFloat(zoneValue.InnerRadius) || 0) + parseFloat(areaValue.D2); // outer size in x
    innerN = 2; // no superEllipses here. just standard ones.
    outerN = 2;


    let startAngle = 360 - (zoneValue.SweepAngle / 2);
    let spanAngle = parseFloat(zoneValue.SweepAngle);
    let innerZ = parseFloat(areaValue.Z1);
    let outerZ = parseFloat(areaValue.Z2);


    // counterclockwise winding for soundvision
    let innerVerts = [];
    let outerVerts = [];
    let startQuadrant = Math.floor(startAngle / 90);
    let endQuadrant = Math.floor((startAngle + spanAngle) / 90.0);
    for (let q = startQuadrant; q <= endQuadrant; q++) {
        let qstart = (q) * 90;
        let qend = (q + 1) * 90;
        if (q == startQuadrant) qstart = startAngle;
        if (q == endQuadrant) qend = startAngle + spanAngle;
        // thought. figure out eucilidean distance between 2 angle points and split if beyond threshold?
        let rangeInQuadrant = qend - qstart;
        let segmentsInQuadrant = Math.ceil(rangeInQuadrant / 10);
        let segmentSpan = rangeInQuadrant / segmentsInQuadrant;
        for (let i = 0; i < segmentsInQuadrant; i++) {
            let segmentStart = (segmentSpan * i) + qstart;
            outerVerts.push(polarInEllipseToCartesian(outer, outer, segmentStart, outerN));
            innerVerts.push(polarInEllipseToCartesian(inner, inner, segmentStart, innerN));
        }
    }
    innerVerts.push(polarInEllipseToCartesian(inner, inner, startAngle + spanAngle, innerN));
    outerVerts.push(polarInEllipseToCartesian(outer, outer, startAngle + spanAngle, outerN));
    // set the z heights
    for (var p = 0; p < innerVerts.length; p++) {
        innerVerts[p].z = innerZ;
        outerVerts[p].z = outerZ;
    }


    let vertices = [];
    for (let vIndex = 0; vIndex < innerVerts.length - 1; vIndex++) {
        vertices.push(innerVerts[vIndex]);
        vertices.push(outerVerts[vIndex]);
        vertices.push(outerVerts[vIndex + 1]);
        vertices.push(outerVerts[vIndex + 1]);
        vertices.push(innerVerts[vIndex + 1]);
        vertices.push(innerVerts[vIndex]);
    }
    var meshVerts = new Float32Array(vertices.length * 3);
    var mIndex = 0;
    for (let i = vertices.length - 1; i >= 0; i--) {
        meshVerts[mIndex * 3] = vertices[i].x;
        meshVerts[mIndex * 3 + 1] = vertices[i].y;
        meshVerts[mIndex * 3 + 2] = vertices[i].z;
        mIndex++;
    };

    const buffergeometry = new BufferGeometry();
    buffergeometry.setAttribute('position', new BufferAttribute(meshVerts, 3));

    buffergeometry.setAttribute('normal', new BufferAttribute(faceNormalsFromVerts(meshVerts), 3));
    buffergeometry.rotateZ(deg2rad(zoneValue.Orientation));
    buffergeometry.translate(currOrigin.x, currOrigin.y, 0);

    //const material = new MeshNormalMaterial({ color: 0x00ff00, side: DoubleSide });
    const material = new MeshNormalMaterial({ side: DoubleSide });

    const mesh = new Mesh(buffergeometry, material);
    setName(mesh, areaValue, zoneValue);


    return mesh;

}


function genRightTrapezoid(zoneValue, areaValue, origin) {
    // rotates around "mid" of front edgeF
    let orthSideIsRight = zoneValue.RightAngleLeft;
    let d1 = parseFloat(areaValue.D1);
    let d2 = parseFloat(areaValue.D2);
    let frontEdge = parseFloat(zoneValue.FrontEdge);
    // let backEdge = parseFloat(zoneValue.BackEdge); taken from zonevalue.depth
    let widthPerUnitDepth = (zoneValue.BackEdge - zoneValue.FrontEdge) / zoneValue.Depth;

    //build it with orthside == 1) {
    var p4 = {
        x: (-zoneValue.Depth / 2) + +d1,
        y: 0,
        z: areaValue.Z1
    }
    var p3 = {
        x: (-zoneValue.Depth / 2) + +d2,
        y: 0,
        z: areaValue.Z2
    }
    var p2 = {
        x: (-zoneValue.Depth / 2) + +d2,
        y: frontEdge + (((-zoneValue.Depth / 2) + +d2) * widthPerUnitDepth),
        z: areaValue.Z2
    }
    var p1 = {
        x: (-zoneValue.Depth / 2) + +d1,
        y: frontEdge + (((-zoneValue.Depth / 2) + +d1) * widthPerUnitDepth),
        z: areaValue.Z1
    }
    let points = [p1, p2, p3, p3, p4, p1];
    if (orthSideIsRight == 0) {
        p2.y = -p2.y;
        p1.y = -p1.y;
        points = [p4, p3, p2, p2, p1, p4]; // flipped thing, wound backwards.
    }
    let vertices = [];
    for (var i = 0; i < points.length; i++) {
        vertices.push(points[i].x);
        vertices.push(points[i].y);
        vertices.push(points[i].z);
    }

    const meshVerts = new Float32Array(vertices);

    const buffergeometry = new BufferGeometry();
    buffergeometry.setAttribute('position', new BufferAttribute(meshVerts, 3));
    buffergeometry.setAttribute('normal', new BufferAttribute(faceNormalsFromVerts(meshVerts), 3));
    buffergeometry.rotateZ(deg2rad(zoneValue.Orientation));
    buffergeometry.translate(origin.x, origin.y, 0);

    // const material = new MeshNormalMaterial({ color: 0x00ff00, side: DoubleSide });
    const material = new MeshNormalMaterial({ side: DoubleSide });

    const mesh = new Mesh(buffergeometry, material);
    setName(mesh, areaValue, zoneValue);
    return mesh;
}

function genTrapezoid(zoneValue, areaValue, origin) {
    let vertices = [];
    let widthPerUnitDepth = (zoneValue.BackEdge - zoneValue.FrontEdge) / zoneValue.Depth;
    let d1 = parseFloat(areaValue.D1);
    let d2 = parseFloat(areaValue.D2);
    let frontEdge = parseFloat(zoneValue.FrontEdge);

    vertices.push(-(zoneValue.Depth / 2) + d2); // cx
    vertices.push((d2 * widthPerUnitDepth / 2) + frontEdge / 2); //cy
    vertices.push(areaValue.Z2); //cz

    vertices.push(-(zoneValue.Depth / 2) + d2); // bx
    vertices.push((-d2 * widthPerUnitDepth / 2) - frontEdge / 2); // by
    vertices.push(areaValue.Z2); // bz

    vertices.push(-(zoneValue.Depth / 2) + d1); // ax
    vertices.push((-d1 * widthPerUnitDepth / 2) - frontEdge / 2); // ay
    vertices.push(areaValue.Z1); // az

    vertices.push(-(zoneValue.Depth / 2) + d1); // ax
    vertices.push((-d1 * widthPerUnitDepth / 2) - frontEdge / 2) // ay
    vertices.push(areaValue.Z1); // az

    vertices.push(-(zoneValue.Depth / 2) + d1); //dx 
    vertices.push((d1 * widthPerUnitDepth / 2) + frontEdge / 2); //dy
    vertices.push(areaValue.Z1); //dz
    
    vertices.push(-(zoneValue.Depth / 2) + d2); // cx
    vertices.push((d2 * widthPerUnitDepth / 2) + frontEdge / 2); //cy
    vertices.push(areaValue.Z2); //cz

    const meshVerts = new Float32Array(vertices);
    const buffergeometry = new BufferGeometry();
    buffergeometry.setAttribute('position', new BufferAttribute(meshVerts, 3));
    buffergeometry.setAttribute('normal', new BufferAttribute(faceNormalsFromVerts(meshVerts), 3));
    buffergeometry.rotateZ(deg2rad(zoneValue.Orientation));
    buffergeometry.translate(origin.x, origin.y, 0);
    //  const material = new MeshNormalMaterial({ color: 0x00ff00, side: DoubleSide });
    const material = new MeshNormalMaterial({ side: DoubleSide });

    const mesh = new Mesh(buffergeometry, material);
    setName(mesh, areaValue, zoneValue);
    return mesh;
}
function setName(mesh, area, zone) {
    mesh.name = area.Label;
    if (mesh.name.length == 0)
        mesh.name = zone.Label;
    if (mesh.name.length == 0)
        mesh.name = "<unnamed>";
}

function genRectangle(zoneValue, areaValue, origin) {
    let vertices = [];
    let d1 = parseFloat(areaValue.D1);
    let d2 = parseFloat(areaValue.D2);
    let frontEdge = parseFloat(zoneValue.FrontEdge);

    vertices.push(-(zoneValue.Depth / 2) + d2); // cx
    vertices.push(zoneValue.Width / 2); // cy
    vertices.push(areaValue.Z2); //cz

    vertices.push(-(zoneValue.Depth / 2) + d2); // bx
    vertices.push(-zoneValue.Width / 2); // by
    vertices.push(areaValue.Z2); // bz

    vertices.push(-(zoneValue.Depth / 2) + d1); // ax
    vertices.push(-zoneValue.Width / 2); // ay
    vertices.push(areaValue.Z1); // az

    vertices.push(-(zoneValue.Depth / 2) + d1); // ax
    vertices.push(-zoneValue.Width / 2); // ay
    vertices.push(areaValue.Z1); // az

    vertices.push(-(zoneValue.Depth / 2) + d1); // dx
    vertices.push(zoneValue.Width / 2); // dy
    vertices.push(areaValue.Z1); // dz

    vertices.push(-(zoneValue.Depth / 2) + d2); // cx
    vertices.push(zoneValue.Width / 2); // cy
    vertices.push(areaValue.Z2); //cz


    const meshVerts = new Float32Array(vertices);
    const buffergeometry = new BufferGeometry();
    buffergeometry.setAttribute('position', new BufferAttribute(meshVerts, 3));
    buffergeometry.setAttribute('normal', new BufferAttribute(faceNormalsFromVerts(meshVerts), 3));
    buffergeometry.rotateZ(deg2rad(zoneValue.Orientation));
    buffergeometry.translate(origin.x, origin.y, 0);

    //  const material = new MeshNormalMaterial({ color: 0x00ff00, side: DoubleSide });
    const material = new MeshNormalMaterial({ side: DoubleSide });

    const mesh = new Mesh(buffergeometry, material);
    setName(mesh, areaValue, zoneValue);
    return mesh;
}



function genGUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function findOffset(buff, signature) { // find where the signature is is the file.
    return buff.findIndex(function (currentValue, index, arr) {
        if ((index + signature.length) > arr.length) return false;
        let aSlice = arr.slice(index, index + signature.length);
        for (var i = 0; i < aSlice.length; i++) {
            if (aSlice[i] !== signature[i]) return false;
            if (i == aSlice.length - 1) return true;
        }
    });
}


export { Fc3Loader };