import * as THREE from 'three';
import { DbacvLoader } from "./loaders/dbacvLoader.js";
import { ArcballControls } from 'three/addons/controls/ArcballControls.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Fc3Loader } from './loaders/fc3Loader.js';
import { deg2rad, rad2deg, faceNormalsFromVerts } from "./ConvertUtils.js";
import { svExporter } from './exporters/svExporter.js';
import { saveAs } from './ConvertUtils';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { dbacvExporter } from './exporters/dbacvExporter.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { XmlsLoader } from './loaders/xmlsLoader.js';


const dropArea = document.getElementById('drop');
const scene = new THREE.Scene();


document.body.addEventListener('dragover', (event) => {
	event.stopPropagation();
	event.preventDefault();
	// Style the drag-and-drop as a "copy file" operation.
	event.dataTransfer.dropEffect = 'copy';
});

document.getElementById("exportSV").addEventListener('click', function () {
	const exporter = new svExporter();
	const outputData = exporter.parse(scene);
	let fileName = "Convertifer3d";

	var blob = new Blob([outputData], {
		type: "text/plain;charset=utf-8;"
	});
	saveAs(blob, fileName + ".txt")

})
document.getElementById("file_upload").addEventListener('change', (event) => {
	processFile(event, event.target.files);
});

document.getElementById("exportOBJ").addEventListener('click', function () {
	const exporter = new OBJExporter();
	const outputData = exporter.parse(scene);
	let fileName = "Convertifer3d";

	var blob = new Blob([outputData], {
		type: "text/plain;charset=utf-8;"
	});
	saveAs(blob, fileName + ".obj")

})
document.getElementById("exportDBACV").addEventListener('click', function () {
	const exporter = new dbacvExporter();
	const outputData = exporter.parse(scene);
	let fileName = "Convertifer3d";
	var blob = new Blob([outputData], {
		type: "text/plain;charset=utf-8;"
	});
	saveAs(blob, fileName + ".dbacv")

})

document.body.addEventListener('drop', (event) => {
	processFile(event);
});

function processFile(event, fileList = event.dataTransfer.files) {

	event.stopPropagation();
	event.preventDefault();
	//	const fileList = event.dataTransfer.files;

	let fileExtension = fileList[0].name.split(".")[1];
	const reader = new FileReader();
	var loader;

	reader.addEventListener('load', (event) => {
		loadFile(event.target.result, loader);
	});

	switch (fileExtension) {
		case "dbacv":
			reader.readAsDataURL(fileList[0]);
			loader = new DbacvLoader();
			break;
		case "fc3":
		case "fc2":
			reader.readAsDataURL(fileList[0]);
			loader = new Fc3Loader();
			break;
		case "obj":
			reader.readAsDataURL(fileList[0]);
			loader = new OBJLoader();
			break;
		case "xmls":
		case "xmlp":
			reader.readAsDataURL(fileList[0]);
			loader = new XmlsLoader();
			break;
	}
}


function loadFile(dataURL, loader) {

	const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

	THREE.Cache.enabled = true;

	//const renderer = new THREE.WebGLRenderer();
	const renderer = new THREE.WebGLRenderer({ antialias: true });

	renderer.setSize(window.innerWidth, window.innerHeight);
	document.getElementById("drop").style.display = "none";
	document.body.appendChild(renderer.domElement);
	const controls = new ArcballControls(camera, renderer.domElement, scene);
	//const controls = new OrbitControls(camera, renderer.domElement);

	controls.addEventListener('change', function () {
		camera.up = new THREE.Vector3(0, 0, 1);
		renderer.render(scene, camera);
	});
	scene.clear();
	loader.load(dataURL,
		function (object) {
			let allObjects = [];
			scene.add(object);
			scene.traverse(function (object) {
				if (object.isMesh) {
					object.material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0x009900});;
					allObjects.push(object.geometry);
				}
			});
			for (let o = 0; o < allObjects.length; o++) {
				const wireframe = new THREE.WireframeGeometry(allObjects[o]);
				const line = new THREE.LineSegments(wireframe);
				line.material.depthTest = true;
				line.material.opacity = 1;
				line.material.transparent = false;
				scene.add(line);
			}
		},
		function (xhr) {
			console.log((xhr.loaded / xhr.total * 100) + '% loaded');
		},
		function (error) {
			console.log("kablooie: " + error)
		}
	)

	camera.position.set(-30, -30, 30);
	camera.lookAt(0, 0, 0);
	camera.up = new THREE.Vector3(0, 0, 1);
	controls.update();

	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();

	function onPointerMove(event) {

		pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
		pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

	}
	const light = new THREE.AmbientLight(0x404040); // soft white light
	scene.add(light);

	function animate() {
		raycaster.setFromCamera(pointer, camera);

		// calculate objects intersecting the picking ray
		const intersects = raycaster.intersectObjects(scene.children);

		for (let i = 0; i < intersects.length; i++) {

		//	intersects[ i ].object.material.color = 0xff0000;//= 0;
		}

		requestAnimationFrame(animate);
		controls.update();

		renderer.render(scene, camera);
		//console.log(renderer.info.render.calls);
		//		console.log(scene.children)

	}
	renderer.render(scene, camera);
	animate();
}



