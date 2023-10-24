import {
    BufferGeometry,
    FileLoader,
    Group,
    Loader,
    Mesh,
    Vector3,
    BufferAttribute,
    MeshNormalMaterial,
    DoubleSide
} from 'three';
import {
    deg2rad,
    rad2deg,
    faceNormalsFromVerts,
    polarInEllipseToCartesian,
} from "../ConvertUtils.js";


class DbacvLoader extends Loader {
    constructor(manager) {
        super(manager);
        this.materials = null;
    }

    load(url, onLoad, onProgress, onError) {
        const scope = this;
        const loader = new FileLoader(this.manager);
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

    parse(text) {
        const geometryGroup = new Group();
        var hasGeometry = false;
        const dbacv = new DOMParser().parseFromString(text, "application/xml");
        var roomObjects = dbacv.getElementsByTagName('RoomObject');
        for (let i = 0; i < roomObjects.length; i++) {
            switch (roomObjects[i].getAttribute('Shape')) {
                case "1":  // quadrangular
                    hasGeometry = true;
                    geometryGroup.add(genPrimitive(roomObjects[i], 4));

                    break
                case "2": //arcSegment  
                    hasGeometry = true;
                    geometryGroup.add(dbGenArcSeg(roomObjects[i], false));
                    break
                case "3": // superelliptic
                    hasGeometry = true;
                    geometryGroup.add(dbGenArcSeg(roomObjects[i], true));
                    break
                case "4": //cube 
                    hasGeometry = true;
                    geometryGroup.add(genCube(roomObjects[i]));
                    break
                case "5": // group "Object"
                    //  We handle by looking up at objects parents.
                    break
                case "6": //triangle
                    hasGeometry = true;
                    geometryGroup.add(genPrimitive(roomObjects[i], 3))
                    break
                default:
                    console.log("Unsupported shape type in dbacv file")
            }
        }
        if (hasGeometry == true) {
            return geometryGroup;
        }
    }
}

function genPrimitive(roomObj, numVertices) {
    const orig = dbGetOriginFromObjectAndGroup(roomObj);
    let vertices = [];
    let vertOrder = [];
    if (numVertices == 4) {
        vertOrder = [0, 1, 2, 2, 3, 0]; // quad as 2 tris.
    }
    if (numVertices == 3) {
        vertOrder = [0, 1, 2];
    }
    if (numVertices > 4) console.log("Oh. Shits gone pentagonal!")

    vertOrder.forEach(function (index) {
        let pointTag = roomObj.getElementsByTagName("P" + (index + 1)); // not zero indexed.
        vertices.push(parseFloat(pointTag[0].getAttribute("x")));
        vertices.push(parseFloat(pointTag[0].getAttribute("y")));
        vertices.push(parseFloat(pointTag[0].getAttribute("z")));
    })
    let angle = 0;
    let rotTags = roomObj.getElementsByTagName("Rotation");
    if (rotTags.length > 0) angle = rotTags[0].getAttribute("z"); // arraycalc doesn't seem to offer rotation around any other axis
    const meshVerts = new Float32Array(vertices);
    const buffergeometry = new BufferGeometry();
    buffergeometry.setAttribute('position', new BufferAttribute(meshVerts, 3));
    buffergeometry.setAttribute('normal', new BufferAttribute(faceNormalsFromVerts(meshVerts), 3));
    buffergeometry.rotateZ(deg2rad(angle));
    buffergeometry.translate(orig.x, orig.y, orig.z)
    // const material = new MeshNormalMaterial({ color: 0x00ff00, side: DoubleSide });
    const material = new MeshNormalMaterial({ side: DoubleSide });
    const mesh = new Mesh(buffergeometry, material);
    mesh.name = roomObj.getAttribute('Name');
    return mesh;
}


function genCube(roomObj) {
    const orig = dbGetOriginFromObjectAndGroup(roomObj);
    const quadName = roomObj.getAttribute('Name');
    let vertices = [];

    let vertOrder = [ // each face to makes two tris:
        2, 1, 0, // a b c
        0, 3, 2, // c b d 
        2, 6, 5,
        5, 1, 2,
        5, 6, 7,
        7, 4, 5,
        7, 3, 0,
        0, 4, 7,
        3, 7, 6,
        6, 2, 3,
        1, 5, 4,
        4, 0, 1
    ]

    vertOrder.forEach(function (index) {
        let pointTag = roomObj.getElementsByTagName("P" + (index + 1)); // not zero indexed.
        vertices.push(parseFloat(pointTag[0].getAttribute("x")));
        vertices.push(parseFloat(pointTag[0].getAttribute("y")));
        vertices.push(parseFloat(pointTag[0].getAttribute("z")));
    })

    const angle = roomObj.getElementsByTagName("Rotation")[0].getAttribute("z");
    const meshVerts = new Float32Array(vertices);
    const buffergeometry = new BufferGeometry();
    buffergeometry.setAttribute('position', new BufferAttribute(meshVerts, 3))
    buffergeometry.setAttribute('normal', new BufferAttribute(faceNormalsFromVerts(meshVerts), 3));

    buffergeometry.rotateZ(deg2rad(angle));
    buffergeometry.translate(orig.x, orig.y, orig.z)
    const material = new MeshNormalMaterial({ side: DoubleSide });
    const mesh = new Mesh(buffergeometry, material);
    mesh.name = roomObj.getAttribute('Name');
    return mesh;
}


function dbGetOriginFromObjectAndGroup(roomObj) {
    var point = roomObj.getElementsByTagName("Origin");
    let orig = new Vector3(
        parseFloat(point[0].getAttribute("x")),
        parseFloat(point[0].getAttribute("y")),
        parseFloat(point[0].getAttribute("z"))
    )
    let groupOrigin = new Vector3(0, 0, 0);
    let originTags = roomObj.parentNode.getElementsByTagName("Origin"); // all the roomobjects.
    for (let i = 0; i < originTags.length; i++) {
        if (originTags[i].parentNode.getAttribute("ObjectGroup") == "true") {
            groupOrigin.x = parseFloat(originTags[i].getAttribute("x"));
            groupOrigin.y = parseFloat(originTags[i].getAttribute("y"));
            groupOrigin.z = parseFloat(originTags[i].getAttribute("z"));
        }
    }
    if (roomObj.parentNode.getAttribute("ObjectGroup") == "true") {
        orig.x += groupOrigin.x;
        orig.y += groupOrigin.y;
        orig.z += groupOrigin.z;
    }
    return orig;
}

function dbGenArcSeg(roomObj, isSuperEllipse) {
    // handles segments and ellipses of arbitrary ranges, hypo, standard + hyper
    const orig = dbGetOriginFromObjectAndGroup(roomObj);
    var innerMajor, outerMajor, innerMinor, outerMinor, innerN, outerN;
    if (isSuperEllipse) {
        innerMajor = parseFloat(roomObj.getAttribute("InnerA")); // inner size in x
        outerMajor = parseFloat(roomObj.getAttribute("OuterA")); // outer size in x
        innerMinor = parseFloat(roomObj.getAttribute("InnerB")); // inner size in y
        outerMinor = parseFloat(roomObj.getAttribute("OuterB")); // outer size in y
        innerN = parseFloat(roomObj.getAttribute("InnerN")); // lets get hyper!
        outerN = parseFloat(roomObj.getAttribute("OuterN"));
    }
    else {
        innerMajor = parseFloat(roomObj.getAttribute("InnerRadiusA")); // inner size in x
        outerMajor = parseFloat(roomObj.getAttribute("OuterRadiusA")); // outer size in x
        innerMinor = parseFloat(roomObj.getAttribute("InnerRadiusB")); // inner size in y
        outerMinor = parseFloat(roomObj.getAttribute("OuterRadiusB")); // outer size in y
        innerN = 2; // no superEllipses here. just standard ones.
        outerN = 2;
    }

    let startAngle = parseFloat(roomObj.getAttribute("StartAngle"));
    let spanAngle = parseFloat(roomObj.getAttribute("SpanAngle"));
    let innerZ = parseFloat(roomObj.getAttribute("InnerZ"));
    let outerZ = parseFloat(roomObj.getAttribute("OuterZ"));
    // counterclockwise winding for soundvision
    let innerVerts = [];
    let outerVerts = [];
    let startQuadrant = Math.floor(startAngle / 90);
    let endQuadrant = Math.floor((startAngle + spanAngle) / 90);
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
            outerVerts.push(polarInEllipseToCartesian(outerMajor, outerMinor, segmentStart, outerN));
            innerVerts.push(polarInEllipseToCartesian(innerMajor, innerMinor, segmentStart, innerN));
        }
    }
    innerVerts.push(polarInEllipseToCartesian(innerMajor, innerMinor, startAngle + spanAngle, innerN));
    outerVerts.push(polarInEllipseToCartesian(outerMajor, outerMinor, startAngle + spanAngle, outerN));

    let flatVertArray = [];
    for (var p = 0; p < innerVerts.length - 1; p++) {
        flatVertArray.push(outerVerts[p].x);
        flatVertArray.push(outerVerts[p].y);
        flatVertArray.push(outerZ);

        flatVertArray.push(outerVerts[p + 1].x);
        flatVertArray.push(outerVerts[p + 1].y);
        flatVertArray.push(outerZ);

        flatVertArray.push(innerVerts[p].x);
        flatVertArray.push(innerVerts[p].y);
        flatVertArray.push(innerZ);

        flatVertArray.push(outerVerts[p + 1].x);
        flatVertArray.push(outerVerts[p + 1].y);
        flatVertArray.push(outerZ);

        flatVertArray.push(innerVerts[p + 1].x);
        flatVertArray.push(innerVerts[p + 1].y);
        flatVertArray.push(innerZ);

        flatVertArray.push(innerVerts[p].x);
        flatVertArray.push(innerVerts[p].y);
        flatVertArray.push(innerZ);
    }

    const meshVerts = new Float32Array(flatVertArray);

    // get object rotation 
    let rotAngle = 0;
    let rotTags = roomObj.getElementsByTagName("Rotation");
    if (rotTags.length > 0) rotAngle = rotTags[0].getAttribute("z"); // arraycalc doesn't seem to offer rotation around any other axis

    const buffergeometry = new BufferGeometry();
    // buffergeometry.setIndex(vertIndex);
    buffergeometry.setAttribute('position', new BufferAttribute(meshVerts, 3));
    buffergeometry.setAttribute('normal', new BufferAttribute(faceNormalsFromVerts(meshVerts), 3));
    buffergeometry.rotateZ(deg2rad(rotAngle));
    buffergeometry.translate(orig.x, orig.y, orig.z)
    const material = new MeshNormalMaterial({ side: DoubleSide });
    const mesh = new Mesh(buffergeometry, material);
    mesh.name = roomObj.getAttribute('Name');
    return mesh;
}


export { DbacvLoader };
