import { Vector3 } from 'three';

class dbacvExporter {
    outputDoc;
    nameList = ["cat", "dog"];
    constructor() {
        this.outputDoc = document.implementation.createDocument("", "", null);
    }

    parse(scene) {
        const objects = [];
        let triangles = 0;
        // XML doc creation and preamble.
        // this.outputDoc = document.implementation.createDocument("", "", null);
        var main = this.outputDoc.createElement("ArrayCalc");
        main.setAttribute("Version", "11.1.1");

        var project = this.outputDoc.createElement("Project");
        project.setAttribute("Name", "Convertifer3D");
        var el = this.outputDoc.createElement("Date");
        var d = new Date();
        el.textContent = d.toLocaleDateString();
        project.appendChild(el);

        el = this.outputDoc.createElement("Author");
        el.textContent = "Convertifer 3D";
        project.appendChild(el);

        el = this.outputDoc.createElement("Comments");
        el.textContent = "Imported with Convertifer3D" // TODO from file
        project.appendChild(el);
        main.appendChild(project);

        let venue = this.outputDoc.createElement("Venue");
        venue.setAttribute("Version", "9"); // sure. 9 sounds good.
        main.appendChild(venue);

        // XML doc created, start adding geometry.
        let xmlParent = venue;
        var self = this;
        scene.traverse(function (object) {
            if (object.parent && !object.parent.isGroup) {
                xmlParent = venue; // not in a group
            }
            if (object.isGroup) {
                var dbacvGroup = self.writeGroup(object);
                venue.appendChild(dbacvGroup);
                xmlParent = dbacvGroup; // I don't think groups can be nested.

            }
            if (object.isMesh) {
                const geometry = object.geometry;
                const index = geometry.index;
                const positionAttribute = geometry.getAttribute('position');
                triangles += (index !== null) ? (index.count / 3) : (positionAttribute.count / 3);
                objects.push({
                    object3d: object,
                    geometry: geometry,
                    parent: xmlParent
                });


            }
        });


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
                    xmlParent.append(self.writeFace(a, b, c, positionAttribute, object));
                }
            } else {
                // non-indexed geometry
                for (let j = 0; j < positionAttribute.count; j += 3) {
                    const c = j + 0;
                    const b = j + 1;
                    const a = j + 2;
                    xmlParent.append(self.writeFace(a, b, c, positionAttribute, object));
                }
            }
        }

        var xmlText = new XMLSerializer().serializeToString(main);
        xmlText = "<!DOCTYPE ArrayCalc>" + xmlText;
        return xmlText;

    }
    writeFace(a, b, c, positionAttribute, faceObject) {
        var face = this.outputDoc.createElement("RoomObject");
        face.setAttribute("Name", this.getUniqueName(faceObject.name));
        face.setAttribute("Shape","6" ); // tri
        face.setAttribute("Enabled", "1"); //
        face.setAttribute("Transparent", "1"); //
        face.setAttribute("Locked", "0"); // 
        face.setAttribute("ListenerHeight", "1.2"); //  make this an option?
        face.setAttribute("Color", "4294967295"); // needs a u.
        face.setAttribute("PrintColor", "4294945280"); // ^
        face.setAttribute("ParentVenueObjectId", "0"); // 
        face.setAttribute("OrderIndex", "4"); // F O U R 
        face.setAttribute("PlaneType", "1");


        const vA = new Vector3();
        const vB = new Vector3();
        const vC = new Vector3();
        vA.fromBufferAttribute(positionAttribute, a);
        vB.fromBufferAttribute(positionAttribute, b);
        vC.fromBufferAttribute(positionAttribute, c);
        vA.applyMatrix4(faceObject.matrixWorld);
        vB.applyMatrix4(faceObject.matrixWorld);
        vC.applyMatrix4(faceObject.matrixWorld);
        this.writeVertex(vA, 1, face);
        this.writeVertex(vB, 2, face);
        this.writeVertex(vC, 3, face);
        this.zeroOrigRotScale(face);
        return face
    }
    writeVertex(vertex, pNumber, parent) {
        let el = this.outputDoc.createElement("P" + pNumber);
        el.setAttribute("x", vertex.x);
        el.setAttribute("y", vertex.y);
        el.setAttribute("z", vertex.z);
        parent.appendChild(el);
       // this.zeroOrigRotScale(parent);
        //let el = doc.
        //     output += vertex.x + ',' + vertex.y + ',' + vertex.z + '\n';
    }

    writeGroup(groupObject) {
        var roomObject = this.outputDoc.createElement("RoomObject");
        roomObject.setAttribute("ObjectGroup", "true");
        roomObject.setAttribute("Shape", "5"); // group "shape"
        roomObject.setAttribute("ObjectGroup", "true");
        roomObject.setAttribute("PlaneType", "1"); // dunno?
        roomObject.setAttribute("Name", this.getUniqueName(groupObject.name));
        roomObject.setAttribute("Enabled", "1"); //
        roomObject.setAttribute("Transparent", "1"); //
        roomObject.setAttribute("Locked", "0"); // 
        roomObject.setAttribute("ListenerHeight", "1.7"); //  make this an option?
        roomObject.setAttribute("Color", "4294967295"); // needs a u.
        roomObject.setAttribute("PrintColor", "4294945280"); // ^
        roomObject.setAttribute("ParentVenueObjectId", "0"); // 
        roomObject.setAttribute("OrderIndex", "4"); // F O U R 

        this.zeroOrigRotScale(roomObject);
        return roomObject;
    }

    zeroOrigRotScale(parentEl) {
        let el = this.outputDoc.createElement("Origin");
        el.setAttribute("x", 0);
        el.setAttribute("y", 0);
        el.setAttribute("z", 0);
        parentEl.appendChild(el);

        el = this.outputDoc.createElement("Rotation");
        el.setAttribute("x", 0);
        el.setAttribute("y", 0);
        el.setAttribute("z", 0);
        parentEl.appendChild(el);

        el = this.outputDoc.createElement("Scaling");
        el.setAttribute("x", "1");
        el.setAttribute("y", "1");
        el.setAttribute("z", "1");
        parentEl.appendChild(el);
    }


    // dbacv requires unique names for elements.
    getUniqueName(desiredName) {
        function filterItems(arr, query) {
            return arr.filter((el) => el.includes(query));
        }
        let count = filterItems(this.nameList, desiredName);
        this.nameList.push(desiredName);

        if (count == 0) return desiredName;
        return (desiredName + "#" + count.length);
    }


}
export { dbacvExporter };