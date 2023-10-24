import { Vector3 } from 'three';

class svExporter {
    parse(scene) {
        const objects = [];
        let triangles = 0;
        scene.traverse(function (object) {
            if (object.isMesh) {
                const geometry = object.geometry;
                const index = geometry.index;
                const positionAttribute = geometry.getAttribute('position');
                triangles += (index !== null) ? (index.count / 3) : (positionAttribute.count / 3);
                objects.push({
                    object3d: object,
                    geometry: geometry
                });
            }
        });

        let output = 
`"; Exported by svExporter"
"; "
";   using Outside is front (white)" 
";   using Name By Layer"
";   using Visible Entities"
";"
";"
";"
"; LengthUnit", "m"
";"\n`
        const vA = new Vector3();
        const vB = new Vector3();
        const vC = new Vector3();

        for (let i = 0; i < objects.length; i++) {
            const object = objects[i].object3d;
            const geometry = objects[i].geometry;
            const index = geometry.index;
            const positionAttribute = geometry.getAttribute('position');

            if (index !== null) {
                // indexed geometry
                for (let j = 0; j < index.count; j += 3) {
                    const c = index.getX(j + 0);
                    const b = index.getX(j + 1);
                    const a = index.getX(j + 2);
                    writeFace(a, b, c, positionAttribute, object);
                }
            } else {
                // non-indexed geometry
                for (let j = 0; j < positionAttribute.count; j += 3) {
                    const c = j + 0;
                    const b = j + 1;
                    const a = j + 2;
                    writeFace(a, b, c, positionAttribute, object);
                }
            }
        }
        return output;

        function writeFace(a, b, c, positionAttribute, object) {
            output += '"Label","'+ object.name + '"\n'
            vA.fromBufferAttribute(positionAttribute, a);
            vB.fromBufferAttribute(positionAttribute, b);
            vC.fromBufferAttribute(positionAttribute, c);
            vA.applyMatrix4(object.matrixWorld);
            vB.applyMatrix4(object.matrixWorld);
            vC.applyMatrix4(object.matrixWorld);
            writeVertex(vA);
            writeVertex(vB);
            writeVertex(vC);
            output += '";"\n'
        }

        function writeVertex(vertex) {
            output += vertex.x + ',' + vertex.y + ',' + vertex.z + '\n';
        }
    }
}

export { svExporter };