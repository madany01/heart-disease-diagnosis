let idx = 0

function createNode(nodeInfo) {
	const id = idx++

	const adjacentNodes = new Map()

	function getNodeInfo() {
		return nodeInfo
	}

	function addAdjacentNode(edge, node) {
		adjacentNodes.set(edge, node)
	}

	function getAdjacentNodes() {
		return new Map(adjacentNodes)
	}

	function isLeaf() {
		return false
	}

	function getId() {
		return id
	}

	return {
		getId,
		isLeaf,
		addAdjacentNode,
		getAdjacentNodes,
		getNodeInfo,
	}
}

function createLeafNode(nodeInfo) {
	const id = idx++

	function isLeaf() {
		return true
	}
	function getNodeInfo() {
		return nodeInfo
	}

	function getId() {
		return id
	}

	return {
		getId,
		isLeaf,
		getNodeInfo,
	}
}

module.exports = {
	createNode,
	createLeafNode,
}
