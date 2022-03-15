function getEdgesAndNodeInfos(root) {
	const edges = []
	const nodesMap = new Map()

	const q = [root]

	while (q.length) {
		const node = q.shift()

		nodesMap.set(node.getId(), node)

		// eslint-disable-next-line no-continue
		if (node.isLeaf()) continue

		node.getAdjacentNodes().forEach((childNode, onValue) => {
			q.push(childNode)
			const entry = [node.getId(), onValue, childNode.getId()]
			if (childNode.isLeaf()) entry.push('leaf 🌿')
			edges.push(entry)
		})
	}

	const nodeInfos = Object.fromEntries([...nodesMap.entries()].map(([nodeId, node]) => {
		const nodeInfo = { ...node.getNodeInfo(), isLeaf: node.isLeaf() }
		return [nodeId, nodeInfo]
	}))

	const output = {
		edges,
		nodeInfos,
	}
	return output
}

function getLayers(root) {
	const layers = []
	const q = [root]
	for (let dep = 0, len = q.length; len; len = q.length, dep++) {
		const layer = []
		while (len--) {
			const node = q.shift()
			layer.push(node)

			// eslint-disable-next-line no-continue
			if (node.isLeaf()) continue

			node.getAdjacentNodes().forEach(adjNode => {
				q.push(adjNode)
			})
		}
		layers.push(layer)
	}

	return layers
}

function getTreeRepresentationForCloudSmart(root) {
	const edges = [{ parent: null, edge: null, child: root }]

	const q = [root]

	for (let len = q.length; len; len = q.length) {
		while (len--) {
			const parent = q.shift()

			// eslint-disable-next-line no-continue
			if (parent.isLeaf()) continue

			parent.getAdjacentNodes().forEach((child, edge) => {
				q.push(child)
				edges.push({ parent, edge, child })
			})
		}
	}
	// make object of infos

	const nodes = edges.map(({ parent, child, edge }) => {
		// parent => 'child'
		const childInfo = child.getNodeInfo()

		const Id = child.getId()

		let Label = null

		if (child.isLeaf()) Label = ['Negative', 'Positive'][childInfo.decision]
		else {
			Label = childInfo.attribute
			if (childInfo.isContinuous) Label += ` (<= ${childInfo.threshold})`
		}

		const LineLabel = edge ?? ''
		const ParentId = parent !== null ? parent.getId() : ''

		return {
			Id, LineLabel, ParentId, Label,
		}
	})

	const treeEdges4CloudSmart = [['ID', 'Label', 'ParentId', 'LineLabel']]
	treeEdges4CloudSmart.push(...nodes.map(obj => [obj.Id, obj.Label, obj.ParentId, obj.LineLabel]))
	return treeEdges4CloudSmart
}

module.exports = { getTreeRepresentationForCloudSmart, getEdgesAndNodeInfos, getLayers }
