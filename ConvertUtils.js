import {
    Vector3,
} from 'three';

export function deg2rad(d) {
    return d * Math.PI / 180
}

export function rad2deg(r) {
    return ((r * 180 / Math.PI) + 360.0) % 360
}


export function faceNormalsFromVerts(faceVerts) {
    let normals = new Float32Array(faceVerts.length);
    let faceIndex = 0;
    for (var f = 0; f < ((faceVerts.length + 1) / 9); f++) { // an error here?
        let a = new Vector3().fromArray(faceVerts, f*9);
        let b = new Vector3().fromArray(faceVerts, f*9 + 3);
        let c = new Vector3().fromArray(faceVerts, f*9 + 6);
        var edgeAB = new Vector3().subVectors(a, b);
        var edgeAC = new Vector3().subVectors(a, c);
        let normal = new Vector3().crossVectors(edgeAB, edgeAC);
        normal.normalize();
        // one for each vert for the whole tri.
        for (var i = 0; i < 3; i++) { // write face normals to all 3 verts
            normals[faceIndex++] = normal.x;
            normals[faceIndex++] = normal.y;
            normals[faceIndex++] = normal.z;
        }
    }
    return normals;
}

export function polarInEllipseToCartesian(major, minor, angle, exponent = 2) {
    let r = major * minor /
        Math.pow(
            Math.pow(major, exponent) * Math.pow(Math.abs(Math.sin(deg2rad(angle))), exponent) +
            Math.pow(minor, exponent) * Math.pow(Math.abs(Math.cos(deg2rad(angle))), exponent),
            1 / exponent);
    let x = r * Math.cos(deg2rad(angle));
    let y = r * Math.sin(deg2rad(angle));
    if (major == 0 || minor == 0) {
        x = 0;
        y = 0;
    }
    return { x, y };
}

export function saveAs(content, fName) {
    const blobURL = window.URL.createObjectURL(content);
    const tempLink = document.createElement('a');
    tempLink.style.display = 'none';
    tempLink.href = blobURL;
    tempLink.setAttribute('download', fName);
    // Safari thinks _blank anchor are pop ups. We only want to set _blank
    // target if the browser does not support the HTML5 download attribute.
    // This allows you to download files in desktop safari if pop up blocking
    // is enabled.
    if (typeof tempLink.download === 'undefined') {
        tempLink.setAttribute('target', '_blank');
    }
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);
    setTimeout(() => {
        // For Firefox it is necessary to delay revoking the ObjectURL
        window.URL.revokeObjectURL(blobURL);
    }, 100);
}