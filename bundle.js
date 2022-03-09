/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./data-mining/algorithms/bayes/createBayesClassifier.js":
/*!***************************************************************!*\
  !*** ./data-mining/algorithms/bayes/createBayesClassifier.js ***!
  \***************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const { calcGaussianDensity } = __webpack_require__(/*! ./utils */ "./data-mining/algorithms/bayes/utils.js")

function createBayesClassifier({
	decisionsFreqs,
	discreteAttributesFreqs,
	continuosAttributesStats,
}) {
	const decisionsFreqsSum = decisionsFreqs.reduce((acc, freq) => acc + freq, 0)
	const [P0, P1] = decisionsFreqs.map(freq => freq / decisionsFreqsSum)

	function getDiscreteAttrsProbs(object) {
		return Object
			.entries(object)
			.filter(([attr, value]) => (
				discreteAttributesFreqs.has(attr) && discreteAttributesFreqs.get(attr).has(value)
			))
			.reduce(
				(probs, [attr, value]) => {
					probs.forEach((_, idx) => {
						const attrFreqMap = discreteAttributesFreqs.get(attr)
						const numUniqueValues = attrFreqMap.size
						probs[idx] *= (attrFreqMap.get(value)[idx] + 1) / (decisionsFreqs[idx] + numUniqueValues)
					})
					return probs
				},
				[1, 1],
			)
	}

	function getContinuousAttrsProbs(object) {
		return Object
			.entries(object)
			.filter(([attr]) => continuosAttributesStats.has(attr))
			.reduce(
				(probs, [attr, value]) => {
					probs.forEach((_, idx) => {
						const mu = continuosAttributesStats.get(attr)[idx].get('mu')
						const sigma = continuosAttributesStats.get(attr)[idx].get('sigma')
						probs[idx] *= calcGaussianDensity(value, mu, sigma)
					})
					return probs
				},
				[1, 1],
			)
	}

	function classify(object) {
		const discreteAttrsProbs = getDiscreteAttrsProbs(object)
		const continuousAttrsProbs = getContinuousAttrsProbs(object)

		const probs = [discreteAttrsProbs, continuousAttrsProbs]
			.reduce((acc, attrProb) => {
				acc[0] *= attrProb[0]
				acc[1] *= attrProb[1]
				return acc
			}, [P0, P1])

		const probsSum = probs.reduce((acc, p) => acc + p, 0)
		probs.forEach((_, idx) => {
			probs[idx] /= probsSum
		})
		return {
			decision: probs[0] > probs[1] ? 0 : 1,
			0: probs[0],
			1: probs[1],
		}
	}

	return {
		classify,
	}
}
module.exports = createBayesClassifier


/***/ }),

/***/ "./data-mining/algorithms/bayes/index.js":
/*!***********************************************!*\
  !*** ./data-mining/algorithms/bayes/index.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const { transpose } = __webpack_require__(/*! ../../array2d-utils */ "./data-mining/array2d-utils/index.js")
const createBayesClassifier = __webpack_require__(/*! ./createBayesClassifier */ "./data-mining/algorithms/bayes/createBayesClassifier.js")

function calcAttributesFrequencies(array2d) {
	const decisionsFreqs = array2d.reduce(
		(acc, row) => {
			acc[row.at(-1)]++
			return acc
		},
		[0, 0],
	)

	const attributesFrequencies = transpose(array2d)
		.map((attrRow, _, transposedArr) => transpose([attrRow, transposedArr.at(-1)]))
		.slice(0, -1)
		.map(attrRowAndDecision => attrRowAndDecision.reduce((attrMap, [attrValue, decision]) => {
			if (!attrMap.has(attrValue)) attrMap.set(attrValue, [0, 0])
			attrMap.get(attrValue)[decision]++
			return attrMap
		}, new Map()))

	return {
		attributesFrequencies,
		decisionsFreqs,
	}
}
function calcAttributesMuSigma2(array2d) {
	return (
		transpose(array2d)
			.map(attrRow => attrRow
				.reduce(
					(acc, val, idx) => {
						const decision = array2d[idx].at(-1)
						acc[decision].push(val)
						return acc
					},
					[[], []],
				)
				.map(groupedAttrRow => groupedAttrRow.filter(val => val !== null))
				.map(groupedAttrRow => {
					const n = groupedAttrRow.length
					const mu = groupedAttrRow.reduce((acc, val) => acc + val, 0) / n
					const sigma = (groupedAttrRow.reduce((acc, val) => acc + (val - mu) ** 2, 0) / (n - 1)) ** 0.5
					return new Map(Object.entries({ mu, sigma }))
				}))
			.slice(0, -1)
	)
}

function trainNaiveBayesClassifier([attrNames, ...data], continuosAttributes = []) {
	const continuosAttributesIndexes = continuosAttributes.map(value => attrNames.findIndex(v => v === value))

	const discreteAttributesIndexes = attrNames
		.slice(0, -1)
		.map((_, idx) => idx)
		.filter(idx => !continuosAttributesIndexes.includes(idx))

	const dataTranspose = transpose(data)
	const decisionArray = dataTranspose.at(-1)

	let continuosAttributesStats = calcAttributesMuSigma2(
		transpose([...continuosAttributesIndexes.map(idx => dataTranspose[idx]), decisionArray]),
	)

	continuosAttributesStats = new Map(
		continuosAttributesStats.map((attrStats, idx) => [attrNames[continuosAttributesIndexes[idx]], attrStats]),
	)

	const result = calcAttributesFrequencies(
		transpose([...discreteAttributesIndexes.map(idx => dataTranspose[idx]), decisionArray]),
	)

	const { decisionsFreqs } = result

	let { attributesFrequencies: discreteAttributesFreqs } = result

	discreteAttributesFreqs
		.filter(attrMap => !attrMap.has(null))
		.forEach(attrMap => {
			attrMap.delete(null)
		})

	discreteAttributesFreqs = new Map(
		discreteAttributesFreqs.map((attrProbs, idx) => [attrNames[discreteAttributesIndexes[idx]], attrProbs]),
	)

	return createBayesClassifier({ decisionsFreqs, discreteAttributesFreqs, continuosAttributesStats })
}

module.exports = trainNaiveBayesClassifier


/***/ }),

/***/ "./data-mining/algorithms/bayes/utils.js":
/*!***********************************************!*\
  !*** ./data-mining/algorithms/bayes/utils.js ***!
  \***********************************************/
/***/ ((module) => {

function calcGaussianDensity(x, mu, sigma) {
	return Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2)) / (((2 * Math.PI) ** 0.5) * sigma)
}

module.exports = { calcGaussianDensity }


/***/ }),

/***/ "./data-mining/algorithms/id3/constructId3Tree.js":
/*!********************************************************!*\
  !*** ./data-mining/algorithms/id3/constructId3Tree.js ***!
  \********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const { createNode, createLeafNode } = __webpack_require__(/*! ./graph */ "./data-mining/algorithms/id3/graph.js")
const { partition2dArray, transpose } = __webpack_require__(/*! ../../array2d-utils */ "./data-mining/array2d-utils/index.js")
const { getAttributeValuesSummary, calcMatrixInfoGain, calcContinuousThresholdValue } = __webpack_require__(/*! ./utils */ "./data-mining/algorithms/id3/utils.js")

function calcDecisionsFrequency(data) {
	return data
		.map(row => row.at(-1))
		.reduce(
			(acc, decision) => {
				acc[decision]++
				return acc
			},
			[0, 0],
		)
}

function getIndexesOfColumnsWithIdenticalValues(data) {
	return transpose(data)
		.map((row, idx) => [row, idx])
		.filter(([row]) => new Set(row).size === 1)
		.map(([, origIdx]) => origIdx)
}

function excludeRedundantAttributes(data, columnNames) {
	const redundantColIndexes = getIndexesOfColumnsWithIdenticalValues(data)
	if (!redundantColIndexes.length) return { data, columnNames }

	const cleanedData = transpose(transpose(data).filter((_, idx) => !redundantColIndexes.includes(idx)))
	const cleanedColumnNames = columnNames.filter((_, idx) => !redundantColIndexes.includes(idx))

	return { data: cleanedData, columnNames: cleanedColumnNames }
}

function transformContinuousAttributesToDiscrete(data, columnNames, continuousAttributes) {
	const continuosIndexes = continuousAttributes
		.map(contAttr => columnNames.findIndex(colName => colName === contAttr))

	const dataTranspose = transpose(data)

	const thresholds = continuosIndexes
		.map(contIdx => {
			const { threshold } = calcContinuousThresholdValue(dataTranspose[contIdx], dataTranspose.at(-1))
			const attributeName = columnNames[contIdx]
			return { attributeName, threshold }
		})
		.reduce((acc, { threshold, attributeName }) => {
			acc.set(attributeName, threshold)
			return acc
		}, new Map())

	const discreteData = transpose(
		dataTranspose.map((attrValues, idx) => {
			if (!continuosIndexes.includes(idx)) return attrValues
			const attrName = columnNames[idx]
			return attrValues.map(value => value <= thresholds.get(attrName))
		}),
	)

	return { thresholds, discreteData }
}

function constructId3Tree({ data, columnNames, continuousAttributes }) {
	const decisionsFreq = calcDecisionsFrequency(data)
	const mostFrequentDecision = decisionsFreq[0] > decisionsFreq[1] ? 0 : 1

	const nodeInfo = {
		decisionsFrequency: decisionsFreq,
		mostFrequentDecision,
	}

	;({ data, columnNames } = excludeRedundantAttributes(data, columnNames))
	continuousAttributes = continuousAttributes.filter(name => columnNames.includes(name))

	if (decisionsFreq.some(freq => freq === 0) || data[0].length === 1) {
		// base cases: all decision values are the same, or the data has no attributes
		// remember 'excludeRedundantAttributes'
		return createLeafNode(Object.assign(nodeInfo, { decision: mostFrequentDecision }))
	}

	const { discreteData, thresholds } = transformContinuousAttributesToDiscrete(
		data,
		columnNames,
		continuousAttributes,
	)

	const attributesInfoGain = calcMatrixInfoGain(discreteData)
	const maxInfoGainIdx = attributesInfoGain.reduce(
		(curMaxIdx, curInfoGain, idx, infoGains) => (curInfoGain > infoGains[curMaxIdx] ? idx : curMaxIdx),
		0,
	)

	Object.assign(nodeInfo, {
		infoGain: attributesInfoGain[maxInfoGainIdx],
		attribute: columnNames[maxInfoGainIdx],
	})

	if (continuousAttributes.includes(columnNames[maxInfoGainIdx])) {
		nodeInfo.isContinuous = true
		nodeInfo.threshold = thresholds.get(columnNames[maxInfoGainIdx])
	} else {
		nodeInfo.isContinuous = false
	}

	if (discreteData[0].length === 2) {
		// base cases: only 1 attribute (+ decision)
		const node = createNode(nodeInfo)

		const [attrValuesMap] = getAttributeValuesSummary(discreteData)

		attrValuesMap.forEach(([n, p], attrValue) => {
			node.addAdjacentNode(
				attrValue,
				createLeafNode({
					decisionsFrequency: [n, p],
					mostFrequentDecision: n > p ? 0 : 1,
					decision: n > p ? 0 : 1,
				}),
			)
		})

		return node
	}

	const columnsToSend = columnNames.filter((_, idx) => idx !== maxInfoGainIdx)

	let dataToPartition
	if (nodeInfo.isContinuous) {
		dataToPartition = transpose(data)
		dataToPartition[maxInfoGainIdx] = dataToPartition[maxInfoGainIdx].map(value => value <= nodeInfo.threshold)
		dataToPartition = transpose(dataToPartition)
	} else {
		dataToPartition = data
	}

	const node = createNode(nodeInfo)

	partition2dArray(dataToPartition, maxInfoGainIdx).forEach((partitionedData, colValueName) => {
		node.addAdjacentNode(
			colValueName,
			constructId3Tree({
				data: partitionedData,
				columnNames: columnsToSend,
				continuousAttributes,
			}),
		)
	})
	return node
}

module.exports = constructId3Tree


/***/ }),

/***/ "./data-mining/algorithms/id3/createId3Classifier.js":
/*!***********************************************************!*\
  !*** ./data-mining/algorithms/id3/createId3Classifier.js ***!
  \***********************************************************/
/***/ ((module) => {

function createId3Classifier({ rootNode, continuousAttributes }) {
	const nodes = getAllTreeNodes(rootNode)

	function classify(object) {
		let node = rootNode
		const path = []
		let decision = null

		while (true) {
			const nodeInfo = node.getNodeInfo()

			if (node.isLeaf()) {
				decision = nodeInfo.decision
				break
			}

			const { attribute } = nodeInfo
			path.push(attribute)

			if (!(attribute in object) || object[attribute] === null) {
				decision = nodeInfo.mostFrequentDecision
				break
			}

			const edge = nodeInfo.isContinuous ? object[attribute] <= nodeInfo.threshold : object[attribute]

			const adjacentNodes = node.getAdjacentNodes()
			if (!adjacentNodes.has(edge)) {
				decision = nodeInfo.mostFrequentDecision
				break
			}

			node = adjacentNodes.get(edge)
		}

		return { decision, path }
	}

	function getRootNode() {
		return Object.freeze({ ...rootNode })
	}

	function getAllTreeNodes(root) {
		const map = new Map()

		const q = [root]

		for (let len = q.length; len > 0; len = q.length) {
			while (len--) {
				const node = q.shift()
				map.set(node.getId(), node)
				if (node.isLeaf()) continue
				node.getAdjacentNodes().forEach(adjNode => q.push(adjNode))
			}
		}

		return map
	}

	function getTreeNodes() {
		return nodes
	}

	return {
		classify,
		getTreeNodes,
		getRootNode,
	}
}
module.exports = createId3Classifier


/***/ }),

/***/ "./data-mining/algorithms/id3/graph.js":
/*!*********************************************!*\
  !*** ./data-mining/algorithms/id3/graph.js ***!
  \*********************************************/
/***/ ((module) => {

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


/***/ }),

/***/ "./data-mining/algorithms/id3/index.js":
/*!*********************************************!*\
  !*** ./data-mining/algorithms/id3/index.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const { transpose } = __webpack_require__(/*! ../../array2d-utils */ "./data-mining/array2d-utils/index.js")
const { fillMissingValues } = __webpack_require__(/*! ./utils */ "./data-mining/algorithms/id3/utils.js")
const createClassifier = __webpack_require__(/*! ./createId3Classifier */ "./data-mining/algorithms/id3/createId3Classifier.js")
const constructId3Tree = __webpack_require__(/*! ./constructId3Tree */ "./data-mining/algorithms/id3/constructId3Tree.js")

function trainId3Classifier([columnNames, ...data], continuousAttributes = []) {
	data = transpose(
		transpose(data)
			.map((attrRow, idx, transposed) => {
				if (idx === transposed.length - 1) return attrRow
				return fillMissingValues(attrRow)
			}),
	)

	const rootNode = constructId3Tree({ data, columnNames, continuousAttributes })

	return createClassifier({ rootNode, continuousAttributes })
}

module.exports = trainId3Classifier


/***/ }),

/***/ "./data-mining/algorithms/id3/utils.js":
/*!*********************************************!*\
  !*** ./data-mining/algorithms/id3/utils.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const { transpose } = __webpack_require__(/*! ../../array2d-utils */ "./data-mining/array2d-utils/index.js")

function fillMissingValues(array) {
	const freqMap = new Map()

	array
		.filter(value => value !== null)
		.forEach(value => {
			const preFreq = freqMap.has(value) ? freqMap.get(value) : 0
			freqMap.set(value, preFreq + 1)
		})

	const freqArray = [...freqMap.entries()]

	const numNonMissingValues = freqArray.reduce((acc, [, freq]) => acc + freq, 0)

	const probArray = [...freqArray]
		.sort(([, freq1], [, freq2]) => freq1 - freq2)
		.map(([value, freq]) => [value, freq / numNonMissingValues])

	probArray.forEach((_, idx) => {
		probArray[idx][1] += idx === 0 ? 0 : probArray[idx - 1][1]
	})

	return array.map(value => {
		if (value !== null) return value
		const rand = Math.random()
		return probArray.find(([, prob]) => rand <= prob)[0]
	})
}

function getAttributeValuesSummary(array2d) {
	/*
	[
		{attr1V1: [n, p], attr1V2: [n, p], attr1V3: [n, p]},
		{attr2V1: [n, p], attr2V2: [n, p], attr2V3: [n, p]},
		..
	]
	*/
	return transpose(array2d)
		.map((attrRow, _, transposedArr) => [attrRow, transposedArr.at(-1)])
		.map(transpose)
		.map(attrDecision => attrDecision.reduce((map, [attrVal, decision]) => {
			if (!map.has(attrVal)) map.set(attrVal, [0, 0])
			map.get(attrVal)[decision]++
			return map
		}, new Map()))
}

function calcEntropy(n, p) {
	if (p === 0 || n === 0) return 0
	return -(p / (p + n)) * Math.log2(p / (p + n)) - (n / (p + n)) * Math.log2(n / (p + n))
}

function calcMatrixInfoGain(array2d) {
	const numSamples = array2d.length

	const attributeValuesSummary = getAttributeValuesSummary(array2d)

	const dataEntropy = calcEntropy(
		attributeValuesSummary.at(-1).get(0)[0],
		attributeValuesSummary.at(-1).get(1)[1],
	)

	const infoEntropies = attributeValuesSummary
		.slice(0, -1)
		.map(attrMap => (
			[...attrMap.values()].reduce((acc, [n, p]) => acc + (calcEntropy(n, p) * (n + p)) / numSamples, 0)
		))

	return infoEntropies.map(ie => dataEntropy - ie)
}
function calcContinuousThresholdValue(valuesArray, decisions) {
	const sortedUniqueValues = [...new Set(valuesArray)].sort((a, b) => a - b)

	console.assert(sortedUniqueValues.length >= 2)

	return sortedUniqueValues
		.reduce((best, _, idx) => {
			if (idx === 0) return null

			const threshold = (sortedUniqueValues[idx] + sortedUniqueValues[idx - 1]) / 2
			const [infoGain] = calcMatrixInfoGain(transpose([valuesArray.map(value => value > threshold), decisions]))

			if (best === null || infoGain > best.infoGain) return { threshold, infoGain }

			return best
		}, null)
}

module.exports = {
	calcContinuousThresholdValue,
	calcEntropy,
	calcMatrixInfoGain,
	fillMissingValues,
	getAttributeValuesSummary,
}


/***/ }),

/***/ "./data-mining/array2d-utils/index.js":
/*!********************************************!*\
  !*** ./data-mining/array2d-utils/index.js ***!
  \********************************************/
/***/ ((module) => {

function partition2dArray(array2d, columnIdx) {
	const numColumns = array2d[0].length
	columnIdx = ((columnIdx % numColumns) + numColumns) % numColumns

	return array2d.reduce((parts, row) => {
		const targetColumnValue = row[columnIdx]

		if (!parts.has(targetColumnValue)) parts.set(targetColumnValue, [])

		parts.get(targetColumnValue).push([...row.slice(0, columnIdx), ...row.slice(columnIdx + 1)])

		return parts
	}, new Map())
}

function transpose(array) {
	const rows = array.length

	if (rows === 0) return []

	const cols = array[0].length

	if (cols === undefined) return transpose([array])

	const ret = new Array(cols).fill(null).map(() => new Array(rows).fill(null))

	for (let i = 0; i < rows; i++) {
		for (let j = 0; j < cols; j++) {
			ret[j][i] = array[i][j]
		}
	}

	return ret
}

module.exports = {
	partition2dArray,
	transpose,
}


/***/ }),

/***/ "./data-mining/prepareData.js":
/*!************************************!*\
  !*** ./data-mining/prepareData.js ***!
  \************************************/
/***/ ((module) => {

function moveDecisionAttributeToLastColumn(data, attributes, decisionAttribute) {
	const j = attributes.findIndex(attr => attr === decisionAttribute)

	const n = attributes.length

	if (j === n - 1) return { data, attributes }

	data = [...data]
	attributes = [...data]

	;[data[j], data[n - 1]] = [data[n - 1], data[j]]
	;[attributes[j], attributes[n - 1]] = [attributes[n - 1], attributes[j]]

	return { data, attributes }
}

function replaceMissingData(data, missingDataValues) {
	return data.map(row => row.map(value => (missingDataValues.includes(value) ? null : value)))
}

function castColumnsToNumber(data, columnIndexes) {
	return data.map(row => {
		row = [...row]
		columnIndexes.forEach(colIdx => {
			row[colIdx] = Number(row[colIdx])
		})
		return row
	})
}

function replaceDecisionAttributesWith0(data, positiveValues) {
	return data.map(row => {
		row = [...row]
		const value = row[row.length - 1]
		row[row.length - 1] = value === positiveValues ? 1 : 0
		return row
	})
}

function prepareData({
	data: origData,
	decisionAttribute,
	missingDataValues,
	continuosAttributes,
	positiveDecisionValue,
	renameDecisionTo = null,
}) {
	let attributes = origData[0]
	let data = origData.slice(1)

	;({ data, attributes } = moveDecisionAttributeToLastColumn(data, attributes, decisionAttribute))
	data = replaceMissingData(data, missingDataValues)

	const continuosAttributesIndexes = continuosAttributes.map(attr => attributes.findIndex(v => v === attr))
	data = castColumnsToNumber(data, continuosAttributesIndexes)

	data = replaceDecisionAttributesWith0(data, positiveDecisionValue)

	if (renameDecisionTo) attributes[attributes.length - 1] = renameDecisionTo

	return { data, attributes }
}

module.exports = prepareData


/***/ }),

/***/ "./data-mining/heart_disease_male.csv":
/*!********************************************!*\
  !*** ./data-mining/heart_disease_male.csv ***!
  \********************************************/
/***/ ((module) => {

module.exports = [["age","chest_pain_type","rest_blood_pressure","blood_sugar","rest_electro","max_heart_rate","exercice_angina","disease"],["43","asympt","140","FALSE","normal","135","yes","positive"],["39","atyp_angina","120","FALSE","normal","160","yes","negative"],["39","non_anginal","160","TRUE","normal","160","no","negative"],["42","non_anginal","160","FALSE","normal","146","no","negative"],["49","asympt","140","FALSE","normal","130","no","negative"],["50","asympt","140","FALSE","normal","135","no","negative"],["59","asympt","140","TRUE","left_vent_hyper","119","yes","positive"],["54","asympt","200","FALSE","normal","142","yes","positive"],["59","asympt","130","FALSE","normal","125","no","positive"],["56","asympt","170","FALSE","st_t_wave_abnormality","122","yes","positive"],["52","non_anginal","140","FALSE","st_t_wave_abnormality","170","no","negative"],["60","asympt","100","FALSE","normal","125","no","positive"],["55","atyp_angina","160","TRUE","normal","143","yes","positive"],["57","atyp_angina","140","TRUE","normal","140","no","negative"],["38","asympt","110","FALSE","normal","166","no","positive"],["60","non_anginal","120","FALSE","left_vent_hyper","135","no","negative"],["55","atyp_angina","140","FALSE","normal","150","no","negative"],["50","asympt","140","FALSE","st_t_wave_abnormality","140","yes","positive"],["48","asympt","106","TRUE","normal","110","no","positive"],["39","atyp_angina","190","FALSE","normal","106","no","negative"],["66","asympt","140","FALSE","normal","94","yes","positive"],["56","asympt","155","TRUE","normal","150","yes","positive"],["44","asympt","135","FALSE","normal","135","no","positive"],["43","asympt","120","FALSE","normal","120","yes","positive"],["54","asympt","140","FALSE","normal","118","yes","positive"],["52","atyp_angina","140","FALSE","normal","138","yes","negative"],["48","asympt","120","FALSE","normal","115","no","positive"],["51","non_anginal","135","FALSE","normal","150","no","positive"],["59","non_anginal","180","FALSE","normal","100","no","negative"],["58","atyp_angina","130","FALSE","normal","110","no","negative"],["46","asympt","118","FALSE","normal","124","no","positive"],["54","asympt","130","FALSE","normal","91","yes","positive"],["48","asympt","160","FALSE","normal","92","yes","positive"],["38","asympt","110","FALSE","normal","150","yes","positive"],["39","atyp_angina","130","FALSE","normal","120","no","negative"],["46","asympt","120","FALSE","normal","115","yes","positive"],["33","non_anginal","120","FALSE","normal","185","no","negative"],["50","asympt","145","FALSE","normal","150","no","positive"],["41","atyp_angina","125","FALSE","normal","144","no","negative"],["49","asympt","140","FALSE","normal","140","yes","positive"],["65","asympt","170","TRUE","normal","112","yes","positive"],["50","atyp_angina","140","FALSE","normal","170","no","negative"],["65","asympt","140","TRUE","normal","87","yes","positive"],["46","typ_angina","140","TRUE","normal","175","no","positive"],["40","non_anginal","140","FALSE","normal","188","no","negative"],["39","atyp_angina","120","FALSE","normal","145","no","negative"],["54","asympt","125","FALSE","normal","140","no","positive"],["48","non_anginal","110","FALSE","normal","138","no","negative"],["55","asympt","140","FALSE","normal","130","yes","positive"],["44","atyp_angina","150","FALSE","normal","150","yes","positive"],["56","non_anginal","130","FALSE","normal","114","no","negative"],["32","atyp_angina","110","FALSE","normal","184","no","negative"],["55","atyp_angina","120","TRUE","normal","137","no","negative"],["54","non_anginal","150","FALSE","normal","122","no","negative"],["51","atyp_angina","125","FALSE","normal","145","no","negative"],["47","atyp_angina","160","FALSE","normal","174","no","negative"],["57","atyp_angina","140","FALSE","st_t_wave_abnormality","145","yes","positive"],["43","atyp_angina","142","FALSE","normal","138","no","negative"],["45","atyp_angina","140","TRUE","normal","122","no","negative"],["53","atyp_angina","140","FALSE","normal","162","no","negative"],["46","non_anginal","120","FALSE","normal","150","no","negative"],["56","non_anginal","130","FALSE","normal","128","yes","negative"],["48","atyp_angina","140","FALSE","normal","118","no","negative"],["55","typ_angina","140","FALSE","?","136","no","positive"],["49","non_anginal","115","FALSE","normal","175","no","positive"],["56","asympt","150","FALSE","st_t_wave_abnormality","124","yes","positive"],["39","atyp_angina","120","FALSE","st_t_wave_abnormality","146","no","negative"],["52","asympt","120","FALSE","normal","150","no","positive"],["53","asympt","130","FALSE","normal","148","no","negative"],["55","non_anginal","120","FALSE","left_vent_hyper","134","no","negative"],["46","asympt","130","FALSE","normal","112","no","positive"],["36","non_anginal","130","FALSE","normal","178","no","negative"],["53","non_anginal","145","FALSE","normal","130","no","positive"],["34","atyp_angina","98","FALSE","normal","150","no","negative"],["31","asympt","120","FALSE","normal","153","yes","positive"],["29","atyp_angina","120","FALSE","normal","160","no","negative"],["46","atyp_angina","140","FALSE","normal","165","yes","negative"],["29","atyp_angina","140","FALSE","normal","170","no","negative"],["43","asympt","150","FALSE","normal","130","yes","positive"],["49","asympt","150","FALSE","normal","122","no","positive"],["39","asympt","110","FALSE","normal","150","no","positive"],["38","asympt","120","FALSE","normal","170","no","positive"],["54","atyp_angina","120","FALSE","normal","154","no","negative"],["40","atyp_angina","130","FALSE","normal","150","no","negative"],["32","asympt","118","FALSE","normal","130","no","positive"],["55","asympt","140","FALSE","normal","110","yes","negative"],["42","atyp_angina","120","FALSE","normal","155","no","negative"],["48","asympt","160","FALSE","normal","103","yes","positive"],["45","asympt","140","FALSE","normal","144","no","negative"],["53","atyp_angina","120","FALSE","normal","132","no","negative"],["39","asympt","110","FALSE","normal","132","no","negative"],["41","asympt","130","FALSE","st_t_wave_abnormality","130","no","positive"],["42","atyp_angina","120","FALSE","normal","150","no","negative"],["49","atyp_angina","100","FALSE","normal","174","no","negative"],["54","atyp_angina","160","FALSE","st_t_wave_abnormality","130","no","negative"],["58","non_anginal","140","FALSE","normal","160","no","negative"],["28","atyp_angina","130","FALSE","left_vent_hyper","185","no","negative"],["46","asympt","110","FALSE","normal","150","yes","positive"],["51","atyp_angina","130","FALSE","normal","150","no","negative"],["48","asympt","160","FALSE","normal","102","yes","positive"],["51","asympt","130","FALSE","normal","100","no","negative"],["42","asympt","140","FALSE","normal","170","no","negative"],["48","asympt","160","FALSE","normal","99","yes","positive"],["32","atyp_angina","125","FALSE","normal","155","no","negative"],["55","non_anginal","110","FALSE","normal","160","no","negative"],["53","asympt","124","FALSE","st_t_wave_abnormality","112","yes","negative"],["46","asympt","180","FALSE","st_t_wave_abnormality","120","no","negative"],["55","atyp_angina","145","FALSE","normal","155","no","negative"],["46","asympt","110","FALSE","st_t_wave_abnormality","140","no","negative"],["49","asympt","128","FALSE","normal","96","yes","positive"],["35","atyp_angina","120","FALSE","left_vent_hyper","180","no","negative"],["35","atyp_angina","110","FALSE","normal","140","no","positive"],["54","non_anginal","120","FALSE","normal","137","no","negative"],["58","atyp_angina","130","FALSE","normal","150","no","negative"],["49","asympt","130","FALSE","normal","120","yes","positive"],["52","atyp_angina","160","FALSE","normal","165","no","negative"],["48","asympt","122","TRUE","st_t_wave_abnormality","150","yes","positive"],["62","atyp_angina","140","FALSE","normal","152","no","negative"],["41","asympt","112","FALSE","normal","142","no","negative"],["52","asympt","160","FALSE","st_t_wave_abnormality","82","yes","positive"],["40","non_anginal","130","FALSE","normal","138","no","negative"],["52","asympt","130","FALSE","normal","120","yes","positive"],["39","asympt","130","FALSE","normal","140","no","negative"],["34","typ_angina","140","FALSE","normal","180","no","positive"],["40","non_anginal","130","FALSE","normal","167","no","negative"],["47","asympt","160","FALSE","st_t_wave_abnormality","158","yes","positive"],["47","asympt","140","TRUE","normal","125","yes","negative"],["56","asympt","120","FALSE","normal","140","no","negative"],["40","atyp_angina","140","FALSE","normal","172","no","negative"],["52","asympt","160","FALSE","normal","94","yes","positive"],["54","atyp_angina","110","FALSE","normal","142","no","negative"],["54","atyp_angina","160","FALSE","normal","175","no","negative"],["53","asympt","120","FALSE","normal","116","yes","positive"],["50","asympt","130","FALSE","normal","121","yes","positive"],["55","asympt","120","FALSE","normal","140","no","negative"],["47","asympt","150","FALSE","normal","98","yes","positive"],["36","non_anginal","112","FALSE","normal","184","no","negative"],["65","asympt","130","FALSE","st_t_wave_abnormality","115","yes","positive"],["37","asympt","140","FALSE","normal","130","yes","positive"],["54","typ_angina","120","FALSE","normal","137","no","negative"],["36","non_anginal","150","FALSE","normal","172","no","negative"],["47","non_anginal","140","FALSE","normal","145","yes","positive"],["36","atyp_angina","120","FALSE","normal","180","no","negative"],["52","asympt","140","FALSE","normal","134","yes","positive"],["41","asympt","110","FALSE","normal","170","no","positive"],["42","non_anginal","120","FALSE","normal","152","yes","negative"],["37","atyp_angina","130","FALSE","st_t_wave_abnormality","98","no","negative"],["58","non_anginal","130","FALSE","st_t_wave_abnormality","140","no","positive"],["50","asympt","150","FALSE","normal","140","yes","negative"],["48","atyp_angina","100","FALSE","normal","100","no","negative"],["58","asympt","135","FALSE","normal","100","no","negative"],["58","atyp_angina","136","FALSE","st_t_wave_abnormality","99","yes","positive"],["44","atyp_angina","120","FALSE","normal","142","no","negative"],["38","non_anginal","145","FALSE","normal","130","no","negative"],["54","atyp_angina","120","FALSE","normal","110","no","negative"],["46","asympt","110","FALSE","st_t_wave_abnormality","140","yes","negative"],["54","non_anginal","120","FALSE","normal","150","yes","positive"],["56","asympt","150","TRUE","normal","125","yes","positive"],["53","non_anginal","120","FALSE","normal","140","no","negative"],["61","asympt","125","FALSE","st_t_wave_abnormality","115","yes","negative"],["49","non_anginal","140","FALSE","normal","172","no","negative"],["50","atyp_angina","170","FALSE","st_t_wave_abnormality","116","no","negative"],["45","non_anginal","135","FALSE","normal","110","no","negative"],["52","asympt","140","FALSE","normal","124","yes","positive"],["50","asympt","140","FALSE","st_t_wave_abnormality","125","yes","positive"],["43","typ_angina","120","FALSE","st_t_wave_abnormality","155","no","positive"],["38","atyp_angina","140","FALSE","normal","150","no","negative"],["53","asympt","180","FALSE","st_t_wave_abnormality","120","yes","positive"],["57","asympt","150","FALSE","normal","92","yes","positive"],["59","atyp_angina","140","FALSE","normal","150","no","negative"],["54","asympt","125","FALSE","normal","122","no","positive"],["39","non_anginal","120","FALSE","normal","170","no","negative"],["50","atyp_angina","120","FALSE","normal","160","no","negative"],["52","atyp_angina","120","FALSE","normal","118","no","negative"],["44","asympt","150","FALSE","normal","170","no","negative"],["36","atyp_angina","120","FALSE","normal","160","no","positive"],["44","atyp_angina","130","FALSE","normal","135","no","negative"],["46","asympt","120","FALSE","normal","125","yes","positive"],["41","asympt","120","FALSE","normal","118","yes","positive"],["45","asympt","120","FALSE","normal","140","no","negative"],["45","asympt","130","FALSE","st_t_wave_abnormality","130","yes","positive"],["52","asympt","130","FALSE","normal","110","yes","positive"],["55","asympt","145","FALSE","normal","96","yes","positive"],["37","non_anginal","130","FALSE","normal","150","no","negative"],["41","atyp_angina","120","FALSE","normal","170","no","negative"],["37","asympt","130","FALSE","normal","158","no","negative"],["44","asympt","130","FALSE","normal","100","yes","positive"],["42","atyp_angina","150","FALSE","normal","136","no","negative"],["41","atyp_angina","120","FALSE","st_t_wave_abnormality","160","no","negative"],["59","asympt","140","FALSE","normal","140","no","negative"],["34","atyp_angina","150","FALSE","st_t_wave_abnormality","168","no","negative"],["52","asympt","170","FALSE","normal","126","yes","positive"],["56","atyp_angina","130","FALSE","normal","100","no","negative"],["38","asympt","92","FALSE","normal","134","yes","positive"],["54","asympt","140","FALSE","normal","105","no","positive"],["48","atyp_angina","130","FALSE","normal","160","no","negative"],["58","asympt","130","FALSE","normal","140","yes","positive"],["54","asympt","130","TRUE","normal","125","yes","positive"],["35","atyp_angina","150","FALSE","normal","168","no","negative"],["58","non_anginal","160","TRUE","st_t_wave_abnormality","92","no","positive"],["55","asympt","140","FALSE","normal","128","yes","positive"],["37","asympt","120","FALSE","normal","168","no","negative"],["54","asympt","150","FALSE","st_t_wave_abnormality","134","no","negative"],["47","typ_angina","110","FALSE","normal","150","no","negative"],["63","asympt","150","FALSE","normal","115","no","positive"],["59","non_anginal","130","FALSE","normal","120","yes","negative"],["52","asympt","112","FALSE","st_t_wave_abnormality","96","yes","positive"],["49","asympt","130","FALSE","normal","170","no","positive"],["53","asympt","140","FALSE","normal","155","no","negative"]]

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _data_mining_algorithms_id3__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../data-mining/algorithms/id3 */ "./data-mining/algorithms/id3/index.js");
/* harmony import */ var _data_mining_algorithms_id3__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_data_mining_algorithms_id3__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _data_mining_prepareData__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../data-mining/prepareData */ "./data-mining/prepareData.js");
/* harmony import */ var _data_mining_prepareData__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_data_mining_prepareData__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _data_mining_algorithms_bayes__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../data-mining/algorithms/bayes */ "./data-mining/algorithms/bayes/index.js");
/* harmony import */ var _data_mining_algorithms_bayes__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_data_mining_algorithms_bayes__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _data_mining_heart_disease_male_csv__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../data-mining/heart_disease_male.csv */ "./data-mining/heart_disease_male.csv");
/* harmony import */ var _data_mining_heart_disease_male_csv__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_data_mining_heart_disease_male_csv__WEBPACK_IMPORTED_MODULE_3__);





const continuosAttributes = ['age', 'rest_blood_pressure', 'max_heart_rate']

const { data: trainData, attributes } = _data_mining_prepareData__WEBPACK_IMPORTED_MODULE_1___default()({
	data: (_data_mining_heart_disease_male_csv__WEBPACK_IMPORTED_MODULE_3___default()),
	continuosAttributes,
	decisionAttribute: 'disease',
	missingDataValues: ['?', ''],
	positiveDecisionValue: 'positive',
	renameDecisionTo: 'decision',
})

trainData.unshift(attributes.slice())

const id3Classifier = _data_mining_algorithms_id3__WEBPACK_IMPORTED_MODULE_0___default()(trainData, continuosAttributes)
const bayesClassifier = _data_mining_algorithms_bayes__WEBPACK_IMPORTED_MODULE_2___default()(trainData, continuosAttributes)

const form = document.querySelector('form')
const resultEl = document.querySelector('.result')
const resultIcon = resultEl.querySelector('.result-icon')

resultIcon.addEventListener('animationend', () => {
	resultIcon.classList.remove('animate')
})

form.addEventListener('input', () => {
	resultEl.classList.remove('show')
	resultIcon.classList.remove('animate')
})

form.addEventListener('submit', e => {
	e.preventDefault()
	const entries = [...new FormData(form)]
		.filter(([, value]) => value !== '')
		.map(([attr, value]) => {
			if (!continuosAttributes.includes(attr)) return [attr, value]
			return [attr, Number(value)]
		})
	const dataObject = Object.fromEntries(entries)
	console.log(dataObject)

	let result

	if (dataObject.algorithm === 'id3') {
		result = id3Classifier.classify(dataObject)
	} else {
		result = bayesClassifier.classify(dataObject)
	}

	console.log(result)
	const { decision } = result
	resultEl.classList.remove('positive', 'negative')
	resultEl.classList.add('show', ['negative', 'positive'][decision])
	resultIcon.classList.add('animate')
})

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLFFBQVEsc0JBQXNCLEVBQUUsbUJBQU8sQ0FBQyx3REFBUzs7QUFFakQ7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDO0FBQ0Q7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNO0FBQ047QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTTtBQUNOO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUk7O0FBRUo7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7OztBQ3hFQSxRQUFRLFlBQVksRUFBRSxtQkFBTyxDQUFDLGlFQUFxQjtBQUNuRCw4QkFBOEIsbUJBQU8sQ0FBQyx3RkFBeUI7O0FBRS9EO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0g7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHFDQUFxQyxXQUFXO0FBQ2hELEtBQUs7QUFDTDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBLFNBQVMsaUJBQWlCOztBQUUxQixPQUFPLGlEQUFpRDs7QUFFeEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHOztBQUVIO0FBQ0E7QUFDQTs7QUFFQSxnQ0FBZ0MsbUVBQW1FO0FBQ25HOztBQUVBOzs7Ozs7Ozs7OztBQ3pGQTtBQUNBO0FBQ0E7O0FBRUEsbUJBQW1COzs7Ozs7Ozs7OztBQ0puQixRQUFRLDZCQUE2QixFQUFFLG1CQUFPLENBQUMsc0RBQVM7QUFDeEQsUUFBUSw4QkFBOEIsRUFBRSxtQkFBTyxDQUFDLGlFQUFxQjtBQUNyRSxRQUFRLDhFQUE4RSxFQUFFLG1CQUFPLENBQUMsc0RBQVM7O0FBRXpHO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSTtBQUNKO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLDJDQUEyQzs7QUFFM0M7QUFDQTs7QUFFQSxVQUFVO0FBQ1Y7O0FBRUE7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQSxXQUFXLFlBQVk7QUFDdkI7QUFDQSxZQUFZO0FBQ1osR0FBRztBQUNILGtCQUFrQiwwQkFBMEI7QUFDNUM7QUFDQTtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSDs7QUFFQSxVQUFVO0FBQ1Y7O0FBRUEsNEJBQTRCLHlDQUF5QztBQUNyRTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLEVBQUUsR0FBRyxvQkFBb0I7QUFDekI7O0FBRUE7QUFDQTtBQUNBO0FBQ0Esa0RBQWtELGdDQUFnQztBQUNsRjs7QUFFQSxTQUFTLDJCQUEyQjtBQUNwQztBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLEVBQUU7O0FBRUY7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNIO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0EsR0FBRzs7QUFFSDtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0g7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUk7QUFDSjtBQUNBLEVBQUU7QUFDRjtBQUNBOztBQUVBOzs7Ozs7Ozs7OztBQ3JKQSwrQkFBK0IsZ0NBQWdDO0FBQy9EOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsV0FBVyxZQUFZO0FBQ3ZCOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQSxXQUFXO0FBQ1g7O0FBRUE7QUFDQSx5QkFBeUIsYUFBYTtBQUN0Qzs7QUFFQTtBQUNBOztBQUVBOztBQUVBLDJCQUEyQixTQUFTO0FBQ3BDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7OztBQ3JFQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7OztBQzVEQSxRQUFRLFlBQVksRUFBRSxtQkFBTyxDQUFDLGlFQUFxQjtBQUNuRCxRQUFRLG9CQUFvQixFQUFFLG1CQUFPLENBQUMsc0RBQVM7QUFDL0MseUJBQXlCLG1CQUFPLENBQUMsa0ZBQXVCO0FBQ3hELHlCQUF5QixtQkFBTyxDQUFDLDRFQUFvQjs7QUFFckQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSTtBQUNKOztBQUVBLHFDQUFxQyx5Q0FBeUM7O0FBRTlFLDJCQUEyQixnQ0FBZ0M7QUFDM0Q7O0FBRUE7Ozs7Ozs7Ozs7O0FDbkJBLFFBQVEsWUFBWSxFQUFFLG1CQUFPLENBQUMsaUVBQXFCOztBQUVuRDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHOztBQUVIOztBQUVBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsRUFBRTs7QUFFRjtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUU7QUFDRjs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxHQUFHLGtEQUFrRDtBQUNyRCxHQUFHLGtEQUFrRDtBQUNyRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUEsMkRBQTJEOztBQUUzRDtBQUNBLEdBQUc7QUFDSDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7QUNoR0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQSxFQUFFO0FBQ0Y7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQTs7QUFFQTs7QUFFQSxpQkFBaUIsVUFBVTtBQUMzQixrQkFBa0IsVUFBVTtBQUM1QjtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7QUN0Q0E7QUFDQTs7QUFFQTs7QUFFQSwyQkFBMkI7O0FBRTNCO0FBQ0E7O0FBRUEsRUFBRTtBQUNGLEVBQUU7O0FBRUYsVUFBVTtBQUNWOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNIO0FBQ0EsRUFBRTtBQUNGOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUU7QUFDRjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7QUFDRDtBQUNBOztBQUVBLEVBQUUsR0FBRyxtQkFBbUI7QUFDeEI7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQSxVQUFVO0FBQ1Y7O0FBRUE7Ozs7Ozs7Ozs7O0FDL0RBOzs7Ozs7VUNBQTtVQUNBOztVQUVBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBOztVQUVBO1VBQ0E7O1VBRUE7VUFDQTtVQUNBOzs7OztXQ3RCQTtXQUNBO1dBQ0E7V0FDQTtXQUNBO1dBQ0EsaUNBQWlDLFdBQVc7V0FDNUM7V0FDQTs7Ozs7V0NQQTtXQUNBO1dBQ0E7V0FDQTtXQUNBLHlDQUF5Qyx3Q0FBd0M7V0FDakY7V0FDQTtXQUNBOzs7OztXQ1BBOzs7OztXQ0FBO1dBQ0E7V0FDQTtXQUNBLHVEQUF1RCxpQkFBaUI7V0FDeEU7V0FDQSxnREFBZ0QsYUFBYTtXQUM3RDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNOK0Q7QUFDWDtBQUNlO0FBQ1I7O0FBRTNEOztBQUVBLFFBQVEsOEJBQThCLEVBQUUsK0RBQVc7QUFDbkQsT0FBTyw0RUFBTztBQUNkO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOztBQUVEOztBQUVBLHNCQUFzQixrRUFBbUI7QUFDekMsd0JBQXdCLG9FQUFxQjs7QUFFN0M7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQSxDQUFDOztBQUVEO0FBQ0E7QUFDQTtBQUNBLENBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0g7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0EsR0FBRztBQUNIO0FBQ0E7O0FBRUE7QUFDQSxTQUFTLFdBQVc7QUFDcEI7QUFDQTtBQUNBO0FBQ0EsQ0FBQyIsInNvdXJjZXMiOlsid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvLi9kYXRhLW1pbmluZy9hbGdvcml0aG1zL2JheWVzL2NyZWF0ZUJheWVzQ2xhc3NpZmllci5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9iYXllcy9pbmRleC5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9iYXllcy91dGlscy5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9pZDMvY29uc3RydWN0SWQzVHJlZS5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9pZDMvY3JlYXRlSWQzQ2xhc3NpZmllci5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9pZDMvZ3JhcGguanMiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL2RhdGEtbWluaW5nL2FsZ29yaXRobXMvaWQzL2luZGV4LmpzIiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvLi9kYXRhLW1pbmluZy9hbGdvcml0aG1zL2lkMy91dGlscy5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvYXJyYXkyZC11dGlscy9pbmRleC5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvcHJlcGFyZURhdGEuanMiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL2RhdGEtbWluaW5nL2hlYXJ0X2Rpc2Vhc2VfbWFsZS5jc3YiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zL3dlYnBhY2svcnVudGltZS9jb21wYXQgZ2V0IGRlZmF1bHQgZXhwb3J0Iiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvd2VicGFjay9ydW50aW1lL2hhc093blByb3BlcnR5IHNob3J0aGFuZCIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB7IGNhbGNHYXVzc2lhbkRlbnNpdHkgfSA9IHJlcXVpcmUoJy4vdXRpbHMnKVxuXG5mdW5jdGlvbiBjcmVhdGVCYXllc0NsYXNzaWZpZXIoe1xuXHRkZWNpc2lvbnNGcmVxcyxcblx0ZGlzY3JldGVBdHRyaWJ1dGVzRnJlcXMsXG5cdGNvbnRpbnVvc0F0dHJpYnV0ZXNTdGF0cyxcbn0pIHtcblx0Y29uc3QgZGVjaXNpb25zRnJlcXNTdW0gPSBkZWNpc2lvbnNGcmVxcy5yZWR1Y2UoKGFjYywgZnJlcSkgPT4gYWNjICsgZnJlcSwgMClcblx0Y29uc3QgW1AwLCBQMV0gPSBkZWNpc2lvbnNGcmVxcy5tYXAoZnJlcSA9PiBmcmVxIC8gZGVjaXNpb25zRnJlcXNTdW0pXG5cblx0ZnVuY3Rpb24gZ2V0RGlzY3JldGVBdHRyc1Byb2JzKG9iamVjdCkge1xuXHRcdHJldHVybiBPYmplY3Rcblx0XHRcdC5lbnRyaWVzKG9iamVjdClcblx0XHRcdC5maWx0ZXIoKFthdHRyLCB2YWx1ZV0pID0+IChcblx0XHRcdFx0ZGlzY3JldGVBdHRyaWJ1dGVzRnJlcXMuaGFzKGF0dHIpICYmIGRpc2NyZXRlQXR0cmlidXRlc0ZyZXFzLmdldChhdHRyKS5oYXModmFsdWUpXG5cdFx0XHQpKVxuXHRcdFx0LnJlZHVjZShcblx0XHRcdFx0KHByb2JzLCBbYXR0ciwgdmFsdWVdKSA9PiB7XG5cdFx0XHRcdFx0cHJvYnMuZm9yRWFjaCgoXywgaWR4KSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBhdHRyRnJlcU1hcCA9IGRpc2NyZXRlQXR0cmlidXRlc0ZyZXFzLmdldChhdHRyKVxuXHRcdFx0XHRcdFx0Y29uc3QgbnVtVW5pcXVlVmFsdWVzID0gYXR0ckZyZXFNYXAuc2l6ZVxuXHRcdFx0XHRcdFx0cHJvYnNbaWR4XSAqPSAoYXR0ckZyZXFNYXAuZ2V0KHZhbHVlKVtpZHhdICsgMSkgLyAoZGVjaXNpb25zRnJlcXNbaWR4XSArIG51bVVuaXF1ZVZhbHVlcylcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdHJldHVybiBwcm9ic1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRbMSwgMV0sXG5cdFx0XHQpXG5cdH1cblxuXHRmdW5jdGlvbiBnZXRDb250aW51b3VzQXR0cnNQcm9icyhvYmplY3QpIHtcblx0XHRyZXR1cm4gT2JqZWN0XG5cdFx0XHQuZW50cmllcyhvYmplY3QpXG5cdFx0XHQuZmlsdGVyKChbYXR0cl0pID0+IGNvbnRpbnVvc0F0dHJpYnV0ZXNTdGF0cy5oYXMoYXR0cikpXG5cdFx0XHQucmVkdWNlKFxuXHRcdFx0XHQocHJvYnMsIFthdHRyLCB2YWx1ZV0pID0+IHtcblx0XHRcdFx0XHRwcm9icy5mb3JFYWNoKChfLCBpZHgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IG11ID0gY29udGludW9zQXR0cmlidXRlc1N0YXRzLmdldChhdHRyKVtpZHhdLmdldCgnbXUnKVxuXHRcdFx0XHRcdFx0Y29uc3Qgc2lnbWEgPSBjb250aW51b3NBdHRyaWJ1dGVzU3RhdHMuZ2V0KGF0dHIpW2lkeF0uZ2V0KCdzaWdtYScpXG5cdFx0XHRcdFx0XHRwcm9ic1tpZHhdICo9IGNhbGNHYXVzc2lhbkRlbnNpdHkodmFsdWUsIG11LCBzaWdtYSlcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdHJldHVybiBwcm9ic1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRbMSwgMV0sXG5cdFx0XHQpXG5cdH1cblxuXHRmdW5jdGlvbiBjbGFzc2lmeShvYmplY3QpIHtcblx0XHRjb25zdCBkaXNjcmV0ZUF0dHJzUHJvYnMgPSBnZXREaXNjcmV0ZUF0dHJzUHJvYnMob2JqZWN0KVxuXHRcdGNvbnN0IGNvbnRpbnVvdXNBdHRyc1Byb2JzID0gZ2V0Q29udGludW91c0F0dHJzUHJvYnMob2JqZWN0KVxuXG5cdFx0Y29uc3QgcHJvYnMgPSBbZGlzY3JldGVBdHRyc1Byb2JzLCBjb250aW51b3VzQXR0cnNQcm9ic11cblx0XHRcdC5yZWR1Y2UoKGFjYywgYXR0clByb2IpID0+IHtcblx0XHRcdFx0YWNjWzBdICo9IGF0dHJQcm9iWzBdXG5cdFx0XHRcdGFjY1sxXSAqPSBhdHRyUHJvYlsxXVxuXHRcdFx0XHRyZXR1cm4gYWNjXG5cdFx0XHR9LCBbUDAsIFAxXSlcblxuXHRcdGNvbnN0IHByb2JzU3VtID0gcHJvYnMucmVkdWNlKChhY2MsIHApID0+IGFjYyArIHAsIDApXG5cdFx0cHJvYnMuZm9yRWFjaCgoXywgaWR4KSA9PiB7XG5cdFx0XHRwcm9ic1tpZHhdIC89IHByb2JzU3VtXG5cdFx0fSlcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGVjaXNpb246IHByb2JzWzBdID4gcHJvYnNbMV0gPyAwIDogMSxcblx0XHRcdDA6IHByb2JzWzBdLFxuXHRcdFx0MTogcHJvYnNbMV0sXG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRjbGFzc2lmeSxcblx0fVxufVxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVCYXllc0NsYXNzaWZpZXJcbiIsImNvbnN0IHsgdHJhbnNwb3NlIH0gPSByZXF1aXJlKCcuLi8uLi9hcnJheTJkLXV0aWxzJylcbmNvbnN0IGNyZWF0ZUJheWVzQ2xhc3NpZmllciA9IHJlcXVpcmUoJy4vY3JlYXRlQmF5ZXNDbGFzc2lmaWVyJylcblxuZnVuY3Rpb24gY2FsY0F0dHJpYnV0ZXNGcmVxdWVuY2llcyhhcnJheTJkKSB7XG5cdGNvbnN0IGRlY2lzaW9uc0ZyZXFzID0gYXJyYXkyZC5yZWR1Y2UoXG5cdFx0KGFjYywgcm93KSA9PiB7XG5cdFx0XHRhY2Nbcm93LmF0KC0xKV0rK1xuXHRcdFx0cmV0dXJuIGFjY1xuXHRcdH0sXG5cdFx0WzAsIDBdLFxuXHQpXG5cblx0Y29uc3QgYXR0cmlidXRlc0ZyZXF1ZW5jaWVzID0gdHJhbnNwb3NlKGFycmF5MmQpXG5cdFx0Lm1hcCgoYXR0clJvdywgXywgdHJhbnNwb3NlZEFycikgPT4gdHJhbnNwb3NlKFthdHRyUm93LCB0cmFuc3Bvc2VkQXJyLmF0KC0xKV0pKVxuXHRcdC5zbGljZSgwLCAtMSlcblx0XHQubWFwKGF0dHJSb3dBbmREZWNpc2lvbiA9PiBhdHRyUm93QW5kRGVjaXNpb24ucmVkdWNlKChhdHRyTWFwLCBbYXR0clZhbHVlLCBkZWNpc2lvbl0pID0+IHtcblx0XHRcdGlmICghYXR0ck1hcC5oYXMoYXR0clZhbHVlKSkgYXR0ck1hcC5zZXQoYXR0clZhbHVlLCBbMCwgMF0pXG5cdFx0XHRhdHRyTWFwLmdldChhdHRyVmFsdWUpW2RlY2lzaW9uXSsrXG5cdFx0XHRyZXR1cm4gYXR0ck1hcFxuXHRcdH0sIG5ldyBNYXAoKSkpXG5cblx0cmV0dXJuIHtcblx0XHRhdHRyaWJ1dGVzRnJlcXVlbmNpZXMsXG5cdFx0ZGVjaXNpb25zRnJlcXMsXG5cdH1cbn1cbmZ1bmN0aW9uIGNhbGNBdHRyaWJ1dGVzTXVTaWdtYTIoYXJyYXkyZCkge1xuXHRyZXR1cm4gKFxuXHRcdHRyYW5zcG9zZShhcnJheTJkKVxuXHRcdFx0Lm1hcChhdHRyUm93ID0+IGF0dHJSb3dcblx0XHRcdFx0LnJlZHVjZShcblx0XHRcdFx0XHQoYWNjLCB2YWwsIGlkeCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgZGVjaXNpb24gPSBhcnJheTJkW2lkeF0uYXQoLTEpXG5cdFx0XHRcdFx0XHRhY2NbZGVjaXNpb25dLnB1c2godmFsKVxuXHRcdFx0XHRcdFx0cmV0dXJuIGFjY1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0W1tdLCBbXV0sXG5cdFx0XHRcdClcblx0XHRcdFx0Lm1hcChncm91cGVkQXR0clJvdyA9PiBncm91cGVkQXR0clJvdy5maWx0ZXIodmFsID0+IHZhbCAhPT0gbnVsbCkpXG5cdFx0XHRcdC5tYXAoZ3JvdXBlZEF0dHJSb3cgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG4gPSBncm91cGVkQXR0clJvdy5sZW5ndGhcblx0XHRcdFx0XHRjb25zdCBtdSA9IGdyb3VwZWRBdHRyUm93LnJlZHVjZSgoYWNjLCB2YWwpID0+IGFjYyArIHZhbCwgMCkgLyBuXG5cdFx0XHRcdFx0Y29uc3Qgc2lnbWEgPSAoZ3JvdXBlZEF0dHJSb3cucmVkdWNlKChhY2MsIHZhbCkgPT4gYWNjICsgKHZhbCAtIG11KSAqKiAyLCAwKSAvIChuIC0gMSkpICoqIDAuNVxuXHRcdFx0XHRcdHJldHVybiBuZXcgTWFwKE9iamVjdC5lbnRyaWVzKHsgbXUsIHNpZ21hIH0pKVxuXHRcdFx0XHR9KSlcblx0XHRcdC5zbGljZSgwLCAtMSlcblx0KVxufVxuXG5mdW5jdGlvbiB0cmFpbk5haXZlQmF5ZXNDbGFzc2lmaWVyKFthdHRyTmFtZXMsIC4uLmRhdGFdLCBjb250aW51b3NBdHRyaWJ1dGVzID0gW10pIHtcblx0Y29uc3QgY29udGludW9zQXR0cmlidXRlc0luZGV4ZXMgPSBjb250aW51b3NBdHRyaWJ1dGVzLm1hcCh2YWx1ZSA9PiBhdHRyTmFtZXMuZmluZEluZGV4KHYgPT4gdiA9PT0gdmFsdWUpKVxuXG5cdGNvbnN0IGRpc2NyZXRlQXR0cmlidXRlc0luZGV4ZXMgPSBhdHRyTmFtZXNcblx0XHQuc2xpY2UoMCwgLTEpXG5cdFx0Lm1hcCgoXywgaWR4KSA9PiBpZHgpXG5cdFx0LmZpbHRlcihpZHggPT4gIWNvbnRpbnVvc0F0dHJpYnV0ZXNJbmRleGVzLmluY2x1ZGVzKGlkeCkpXG5cblx0Y29uc3QgZGF0YVRyYW5zcG9zZSA9IHRyYW5zcG9zZShkYXRhKVxuXHRjb25zdCBkZWNpc2lvbkFycmF5ID0gZGF0YVRyYW5zcG9zZS5hdCgtMSlcblxuXHRsZXQgY29udGludW9zQXR0cmlidXRlc1N0YXRzID0gY2FsY0F0dHJpYnV0ZXNNdVNpZ21hMihcblx0XHR0cmFuc3Bvc2UoWy4uLmNvbnRpbnVvc0F0dHJpYnV0ZXNJbmRleGVzLm1hcChpZHggPT4gZGF0YVRyYW5zcG9zZVtpZHhdKSwgZGVjaXNpb25BcnJheV0pLFxuXHQpXG5cblx0Y29udGludW9zQXR0cmlidXRlc1N0YXRzID0gbmV3IE1hcChcblx0XHRjb250aW51b3NBdHRyaWJ1dGVzU3RhdHMubWFwKChhdHRyU3RhdHMsIGlkeCkgPT4gW2F0dHJOYW1lc1tjb250aW51b3NBdHRyaWJ1dGVzSW5kZXhlc1tpZHhdXSwgYXR0clN0YXRzXSksXG5cdClcblxuXHRjb25zdCByZXN1bHQgPSBjYWxjQXR0cmlidXRlc0ZyZXF1ZW5jaWVzKFxuXHRcdHRyYW5zcG9zZShbLi4uZGlzY3JldGVBdHRyaWJ1dGVzSW5kZXhlcy5tYXAoaWR4ID0+IGRhdGFUcmFuc3Bvc2VbaWR4XSksIGRlY2lzaW9uQXJyYXldKSxcblx0KVxuXG5cdGNvbnN0IHsgZGVjaXNpb25zRnJlcXMgfSA9IHJlc3VsdFxuXG5cdGxldCB7IGF0dHJpYnV0ZXNGcmVxdWVuY2llczogZGlzY3JldGVBdHRyaWJ1dGVzRnJlcXMgfSA9IHJlc3VsdFxuXG5cdGRpc2NyZXRlQXR0cmlidXRlc0ZyZXFzXG5cdFx0LmZpbHRlcihhdHRyTWFwID0+ICFhdHRyTWFwLmhhcyhudWxsKSlcblx0XHQuZm9yRWFjaChhdHRyTWFwID0+IHtcblx0XHRcdGF0dHJNYXAuZGVsZXRlKG51bGwpXG5cdFx0fSlcblxuXHRkaXNjcmV0ZUF0dHJpYnV0ZXNGcmVxcyA9IG5ldyBNYXAoXG5cdFx0ZGlzY3JldGVBdHRyaWJ1dGVzRnJlcXMubWFwKChhdHRyUHJvYnMsIGlkeCkgPT4gW2F0dHJOYW1lc1tkaXNjcmV0ZUF0dHJpYnV0ZXNJbmRleGVzW2lkeF1dLCBhdHRyUHJvYnNdKSxcblx0KVxuXG5cdHJldHVybiBjcmVhdGVCYXllc0NsYXNzaWZpZXIoeyBkZWNpc2lvbnNGcmVxcywgZGlzY3JldGVBdHRyaWJ1dGVzRnJlcXMsIGNvbnRpbnVvc0F0dHJpYnV0ZXNTdGF0cyB9KVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRyYWluTmFpdmVCYXllc0NsYXNzaWZpZXJcbiIsImZ1bmN0aW9uIGNhbGNHYXVzc2lhbkRlbnNpdHkoeCwgbXUsIHNpZ21hKSB7XG5cdHJldHVybiBNYXRoLmV4cCgtKCh4IC0gbXUpICoqIDIpIC8gKDIgKiBzaWdtYSAqKiAyKSkgLyAoKCgyICogTWF0aC5QSSkgKiogMC41KSAqIHNpZ21hKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHsgY2FsY0dhdXNzaWFuRGVuc2l0eSB9XG4iLCJjb25zdCB7IGNyZWF0ZU5vZGUsIGNyZWF0ZUxlYWZOb2RlIH0gPSByZXF1aXJlKCcuL2dyYXBoJylcbmNvbnN0IHsgcGFydGl0aW9uMmRBcnJheSwgdHJhbnNwb3NlIH0gPSByZXF1aXJlKCcuLi8uLi9hcnJheTJkLXV0aWxzJylcbmNvbnN0IHsgZ2V0QXR0cmlidXRlVmFsdWVzU3VtbWFyeSwgY2FsY01hdHJpeEluZm9HYWluLCBjYWxjQ29udGludW91c1RocmVzaG9sZFZhbHVlIH0gPSByZXF1aXJlKCcuL3V0aWxzJylcblxuZnVuY3Rpb24gY2FsY0RlY2lzaW9uc0ZyZXF1ZW5jeShkYXRhKSB7XG5cdHJldHVybiBkYXRhXG5cdFx0Lm1hcChyb3cgPT4gcm93LmF0KC0xKSlcblx0XHQucmVkdWNlKFxuXHRcdFx0KGFjYywgZGVjaXNpb24pID0+IHtcblx0XHRcdFx0YWNjW2RlY2lzaW9uXSsrXG5cdFx0XHRcdHJldHVybiBhY2Ncblx0XHRcdH0sXG5cdFx0XHRbMCwgMF0sXG5cdFx0KVxufVxuXG5mdW5jdGlvbiBnZXRJbmRleGVzT2ZDb2x1bW5zV2l0aElkZW50aWNhbFZhbHVlcyhkYXRhKSB7XG5cdHJldHVybiB0cmFuc3Bvc2UoZGF0YSlcblx0XHQubWFwKChyb3csIGlkeCkgPT4gW3JvdywgaWR4XSlcblx0XHQuZmlsdGVyKChbcm93XSkgPT4gbmV3IFNldChyb3cpLnNpemUgPT09IDEpXG5cdFx0Lm1hcCgoWywgb3JpZ0lkeF0pID0+IG9yaWdJZHgpXG59XG5cbmZ1bmN0aW9uIGV4Y2x1ZGVSZWR1bmRhbnRBdHRyaWJ1dGVzKGRhdGEsIGNvbHVtbk5hbWVzKSB7XG5cdGNvbnN0IHJlZHVuZGFudENvbEluZGV4ZXMgPSBnZXRJbmRleGVzT2ZDb2x1bW5zV2l0aElkZW50aWNhbFZhbHVlcyhkYXRhKVxuXHRpZiAoIXJlZHVuZGFudENvbEluZGV4ZXMubGVuZ3RoKSByZXR1cm4geyBkYXRhLCBjb2x1bW5OYW1lcyB9XG5cblx0Y29uc3QgY2xlYW5lZERhdGEgPSB0cmFuc3Bvc2UodHJhbnNwb3NlKGRhdGEpLmZpbHRlcigoXywgaWR4KSA9PiAhcmVkdW5kYW50Q29sSW5kZXhlcy5pbmNsdWRlcyhpZHgpKSlcblx0Y29uc3QgY2xlYW5lZENvbHVtbk5hbWVzID0gY29sdW1uTmFtZXMuZmlsdGVyKChfLCBpZHgpID0+ICFyZWR1bmRhbnRDb2xJbmRleGVzLmluY2x1ZGVzKGlkeCkpXG5cblx0cmV0dXJuIHsgZGF0YTogY2xlYW5lZERhdGEsIGNvbHVtbk5hbWVzOiBjbGVhbmVkQ29sdW1uTmFtZXMgfVxufVxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1Db250aW51b3VzQXR0cmlidXRlc1RvRGlzY3JldGUoZGF0YSwgY29sdW1uTmFtZXMsIGNvbnRpbnVvdXNBdHRyaWJ1dGVzKSB7XG5cdGNvbnN0IGNvbnRpbnVvc0luZGV4ZXMgPSBjb250aW51b3VzQXR0cmlidXRlc1xuXHRcdC5tYXAoY29udEF0dHIgPT4gY29sdW1uTmFtZXMuZmluZEluZGV4KGNvbE5hbWUgPT4gY29sTmFtZSA9PT0gY29udEF0dHIpKVxuXG5cdGNvbnN0IGRhdGFUcmFuc3Bvc2UgPSB0cmFuc3Bvc2UoZGF0YSlcblxuXHRjb25zdCB0aHJlc2hvbGRzID0gY29udGludW9zSW5kZXhlc1xuXHRcdC5tYXAoY29udElkeCA9PiB7XG5cdFx0XHRjb25zdCB7IHRocmVzaG9sZCB9ID0gY2FsY0NvbnRpbnVvdXNUaHJlc2hvbGRWYWx1ZShkYXRhVHJhbnNwb3NlW2NvbnRJZHhdLCBkYXRhVHJhbnNwb3NlLmF0KC0xKSlcblx0XHRcdGNvbnN0IGF0dHJpYnV0ZU5hbWUgPSBjb2x1bW5OYW1lc1tjb250SWR4XVxuXHRcdFx0cmV0dXJuIHsgYXR0cmlidXRlTmFtZSwgdGhyZXNob2xkIH1cblx0XHR9KVxuXHRcdC5yZWR1Y2UoKGFjYywgeyB0aHJlc2hvbGQsIGF0dHJpYnV0ZU5hbWUgfSkgPT4ge1xuXHRcdFx0YWNjLnNldChhdHRyaWJ1dGVOYW1lLCB0aHJlc2hvbGQpXG5cdFx0XHRyZXR1cm4gYWNjXG5cdFx0fSwgbmV3IE1hcCgpKVxuXG5cdGNvbnN0IGRpc2NyZXRlRGF0YSA9IHRyYW5zcG9zZShcblx0XHRkYXRhVHJhbnNwb3NlLm1hcCgoYXR0clZhbHVlcywgaWR4KSA9PiB7XG5cdFx0XHRpZiAoIWNvbnRpbnVvc0luZGV4ZXMuaW5jbHVkZXMoaWR4KSkgcmV0dXJuIGF0dHJWYWx1ZXNcblx0XHRcdGNvbnN0IGF0dHJOYW1lID0gY29sdW1uTmFtZXNbaWR4XVxuXHRcdFx0cmV0dXJuIGF0dHJWYWx1ZXMubWFwKHZhbHVlID0+IHZhbHVlIDw9IHRocmVzaG9sZHMuZ2V0KGF0dHJOYW1lKSlcblx0XHR9KSxcblx0KVxuXG5cdHJldHVybiB7IHRocmVzaG9sZHMsIGRpc2NyZXRlRGF0YSB9XG59XG5cbmZ1bmN0aW9uIGNvbnN0cnVjdElkM1RyZWUoeyBkYXRhLCBjb2x1bW5OYW1lcywgY29udGludW91c0F0dHJpYnV0ZXMgfSkge1xuXHRjb25zdCBkZWNpc2lvbnNGcmVxID0gY2FsY0RlY2lzaW9uc0ZyZXF1ZW5jeShkYXRhKVxuXHRjb25zdCBtb3N0RnJlcXVlbnREZWNpc2lvbiA9IGRlY2lzaW9uc0ZyZXFbMF0gPiBkZWNpc2lvbnNGcmVxWzFdID8gMCA6IDFcblxuXHRjb25zdCBub2RlSW5mbyA9IHtcblx0XHRkZWNpc2lvbnNGcmVxdWVuY3k6IGRlY2lzaW9uc0ZyZXEsXG5cdFx0bW9zdEZyZXF1ZW50RGVjaXNpb24sXG5cdH1cblxuXHQ7KHsgZGF0YSwgY29sdW1uTmFtZXMgfSA9IGV4Y2x1ZGVSZWR1bmRhbnRBdHRyaWJ1dGVzKGRhdGEsIGNvbHVtbk5hbWVzKSlcblx0Y29udGludW91c0F0dHJpYnV0ZXMgPSBjb250aW51b3VzQXR0cmlidXRlcy5maWx0ZXIobmFtZSA9PiBjb2x1bW5OYW1lcy5pbmNsdWRlcyhuYW1lKSlcblxuXHRpZiAoZGVjaXNpb25zRnJlcS5zb21lKGZyZXEgPT4gZnJlcSA9PT0gMCkgfHwgZGF0YVswXS5sZW5ndGggPT09IDEpIHtcblx0XHQvLyBiYXNlIGNhc2VzOiBhbGwgZGVjaXNpb24gdmFsdWVzIGFyZSB0aGUgc2FtZSwgb3IgdGhlIGRhdGEgaGFzIG5vIGF0dHJpYnV0ZXNcblx0XHQvLyByZW1lbWJlciAnZXhjbHVkZVJlZHVuZGFudEF0dHJpYnV0ZXMnXG5cdFx0cmV0dXJuIGNyZWF0ZUxlYWZOb2RlKE9iamVjdC5hc3NpZ24obm9kZUluZm8sIHsgZGVjaXNpb246IG1vc3RGcmVxdWVudERlY2lzaW9uIH0pKVxuXHR9XG5cblx0Y29uc3QgeyBkaXNjcmV0ZURhdGEsIHRocmVzaG9sZHMgfSA9IHRyYW5zZm9ybUNvbnRpbnVvdXNBdHRyaWJ1dGVzVG9EaXNjcmV0ZShcblx0XHRkYXRhLFxuXHRcdGNvbHVtbk5hbWVzLFxuXHRcdGNvbnRpbnVvdXNBdHRyaWJ1dGVzLFxuXHQpXG5cblx0Y29uc3QgYXR0cmlidXRlc0luZm9HYWluID0gY2FsY01hdHJpeEluZm9HYWluKGRpc2NyZXRlRGF0YSlcblx0Y29uc3QgbWF4SW5mb0dhaW5JZHggPSBhdHRyaWJ1dGVzSW5mb0dhaW4ucmVkdWNlKFxuXHRcdChjdXJNYXhJZHgsIGN1ckluZm9HYWluLCBpZHgsIGluZm9HYWlucykgPT4gKGN1ckluZm9HYWluID4gaW5mb0dhaW5zW2N1ck1heElkeF0gPyBpZHggOiBjdXJNYXhJZHgpLFxuXHRcdDAsXG5cdClcblxuXHRPYmplY3QuYXNzaWduKG5vZGVJbmZvLCB7XG5cdFx0aW5mb0dhaW46IGF0dHJpYnV0ZXNJbmZvR2FpblttYXhJbmZvR2FpbklkeF0sXG5cdFx0YXR0cmlidXRlOiBjb2x1bW5OYW1lc1ttYXhJbmZvR2FpbklkeF0sXG5cdH0pXG5cblx0aWYgKGNvbnRpbnVvdXNBdHRyaWJ1dGVzLmluY2x1ZGVzKGNvbHVtbk5hbWVzW21heEluZm9HYWluSWR4XSkpIHtcblx0XHRub2RlSW5mby5pc0NvbnRpbnVvdXMgPSB0cnVlXG5cdFx0bm9kZUluZm8udGhyZXNob2xkID0gdGhyZXNob2xkcy5nZXQoY29sdW1uTmFtZXNbbWF4SW5mb0dhaW5JZHhdKVxuXHR9IGVsc2Uge1xuXHRcdG5vZGVJbmZvLmlzQ29udGludW91cyA9IGZhbHNlXG5cdH1cblxuXHRpZiAoZGlzY3JldGVEYXRhWzBdLmxlbmd0aCA9PT0gMikge1xuXHRcdC8vIGJhc2UgY2FzZXM6IG9ubHkgMSBhdHRyaWJ1dGUgKCsgZGVjaXNpb24pXG5cdFx0Y29uc3Qgbm9kZSA9IGNyZWF0ZU5vZGUobm9kZUluZm8pXG5cblx0XHRjb25zdCBbYXR0clZhbHVlc01hcF0gPSBnZXRBdHRyaWJ1dGVWYWx1ZXNTdW1tYXJ5KGRpc2NyZXRlRGF0YSlcblxuXHRcdGF0dHJWYWx1ZXNNYXAuZm9yRWFjaCgoW24sIHBdLCBhdHRyVmFsdWUpID0+IHtcblx0XHRcdG5vZGUuYWRkQWRqYWNlbnROb2RlKFxuXHRcdFx0XHRhdHRyVmFsdWUsXG5cdFx0XHRcdGNyZWF0ZUxlYWZOb2RlKHtcblx0XHRcdFx0XHRkZWNpc2lvbnNGcmVxdWVuY3k6IFtuLCBwXSxcblx0XHRcdFx0XHRtb3N0RnJlcXVlbnREZWNpc2lvbjogbiA+IHAgPyAwIDogMSxcblx0XHRcdFx0XHRkZWNpc2lvbjogbiA+IHAgPyAwIDogMSxcblx0XHRcdFx0fSksXG5cdFx0XHQpXG5cdFx0fSlcblxuXHRcdHJldHVybiBub2RlXG5cdH1cblxuXHRjb25zdCBjb2x1bW5zVG9TZW5kID0gY29sdW1uTmFtZXMuZmlsdGVyKChfLCBpZHgpID0+IGlkeCAhPT0gbWF4SW5mb0dhaW5JZHgpXG5cblx0bGV0IGRhdGFUb1BhcnRpdGlvblxuXHRpZiAobm9kZUluZm8uaXNDb250aW51b3VzKSB7XG5cdFx0ZGF0YVRvUGFydGl0aW9uID0gdHJhbnNwb3NlKGRhdGEpXG5cdFx0ZGF0YVRvUGFydGl0aW9uW21heEluZm9HYWluSWR4XSA9IGRhdGFUb1BhcnRpdGlvblttYXhJbmZvR2FpbklkeF0ubWFwKHZhbHVlID0+IHZhbHVlIDw9IG5vZGVJbmZvLnRocmVzaG9sZClcblx0XHRkYXRhVG9QYXJ0aXRpb24gPSB0cmFuc3Bvc2UoZGF0YVRvUGFydGl0aW9uKVxuXHR9IGVsc2Uge1xuXHRcdGRhdGFUb1BhcnRpdGlvbiA9IGRhdGFcblx0fVxuXG5cdGNvbnN0IG5vZGUgPSBjcmVhdGVOb2RlKG5vZGVJbmZvKVxuXG5cdHBhcnRpdGlvbjJkQXJyYXkoZGF0YVRvUGFydGl0aW9uLCBtYXhJbmZvR2FpbklkeCkuZm9yRWFjaCgocGFydGl0aW9uZWREYXRhLCBjb2xWYWx1ZU5hbWUpID0+IHtcblx0XHRub2RlLmFkZEFkamFjZW50Tm9kZShcblx0XHRcdGNvbFZhbHVlTmFtZSxcblx0XHRcdGNvbnN0cnVjdElkM1RyZWUoe1xuXHRcdFx0XHRkYXRhOiBwYXJ0aXRpb25lZERhdGEsXG5cdFx0XHRcdGNvbHVtbk5hbWVzOiBjb2x1bW5zVG9TZW5kLFxuXHRcdFx0XHRjb250aW51b3VzQXR0cmlidXRlcyxcblx0XHRcdH0pLFxuXHRcdClcblx0fSlcblx0cmV0dXJuIG5vZGVcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjb25zdHJ1Y3RJZDNUcmVlXG4iLCJmdW5jdGlvbiBjcmVhdGVJZDNDbGFzc2lmaWVyKHsgcm9vdE5vZGUsIGNvbnRpbnVvdXNBdHRyaWJ1dGVzIH0pIHtcblx0Y29uc3Qgbm9kZXMgPSBnZXRBbGxUcmVlTm9kZXMocm9vdE5vZGUpXG5cblx0ZnVuY3Rpb24gY2xhc3NpZnkob2JqZWN0KSB7XG5cdFx0bGV0IG5vZGUgPSByb290Tm9kZVxuXHRcdGNvbnN0IHBhdGggPSBbXVxuXHRcdGxldCBkZWNpc2lvbiA9IG51bGxcblxuXHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRjb25zdCBub2RlSW5mbyA9IG5vZGUuZ2V0Tm9kZUluZm8oKVxuXG5cdFx0XHRpZiAobm9kZS5pc0xlYWYoKSkge1xuXHRcdFx0XHRkZWNpc2lvbiA9IG5vZGVJbmZvLmRlY2lzaW9uXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHsgYXR0cmlidXRlIH0gPSBub2RlSW5mb1xuXHRcdFx0cGF0aC5wdXNoKGF0dHJpYnV0ZSlcblxuXHRcdFx0aWYgKCEoYXR0cmlidXRlIGluIG9iamVjdCkgfHwgb2JqZWN0W2F0dHJpYnV0ZV0gPT09IG51bGwpIHtcblx0XHRcdFx0ZGVjaXNpb24gPSBub2RlSW5mby5tb3N0RnJlcXVlbnREZWNpc2lvblxuXHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBlZGdlID0gbm9kZUluZm8uaXNDb250aW51b3VzID8gb2JqZWN0W2F0dHJpYnV0ZV0gPD0gbm9kZUluZm8udGhyZXNob2xkIDogb2JqZWN0W2F0dHJpYnV0ZV1cblxuXHRcdFx0Y29uc3QgYWRqYWNlbnROb2RlcyA9IG5vZGUuZ2V0QWRqYWNlbnROb2RlcygpXG5cdFx0XHRpZiAoIWFkamFjZW50Tm9kZXMuaGFzKGVkZ2UpKSB7XG5cdFx0XHRcdGRlY2lzaW9uID0gbm9kZUluZm8ubW9zdEZyZXF1ZW50RGVjaXNpb25cblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblxuXHRcdFx0bm9kZSA9IGFkamFjZW50Tm9kZXMuZ2V0KGVkZ2UpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgZGVjaXNpb24sIHBhdGggfVxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0Um9vdE5vZGUoKSB7XG5cdFx0cmV0dXJuIE9iamVjdC5mcmVlemUoeyAuLi5yb290Tm9kZSB9KVxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0QWxsVHJlZU5vZGVzKHJvb3QpIHtcblx0XHRjb25zdCBtYXAgPSBuZXcgTWFwKClcblxuXHRcdGNvbnN0IHEgPSBbcm9vdF1cblxuXHRcdGZvciAobGV0IGxlbiA9IHEubGVuZ3RoOyBsZW4gPiAwOyBsZW4gPSBxLmxlbmd0aCkge1xuXHRcdFx0d2hpbGUgKGxlbi0tKSB7XG5cdFx0XHRcdGNvbnN0IG5vZGUgPSBxLnNoaWZ0KClcblx0XHRcdFx0bWFwLnNldChub2RlLmdldElkKCksIG5vZGUpXG5cdFx0XHRcdGlmIChub2RlLmlzTGVhZigpKSBjb250aW51ZVxuXHRcdFx0XHRub2RlLmdldEFkamFjZW50Tm9kZXMoKS5mb3JFYWNoKGFkak5vZGUgPT4gcS5wdXNoKGFkak5vZGUpKVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBtYXBcblx0fVxuXG5cdGZ1bmN0aW9uIGdldFRyZWVOb2RlcygpIHtcblx0XHRyZXR1cm4gbm9kZXNcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0Y2xhc3NpZnksXG5cdFx0Z2V0VHJlZU5vZGVzLFxuXHRcdGdldFJvb3ROb2RlLFxuXHR9XG59XG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUlkM0NsYXNzaWZpZXJcbiIsImxldCBpZHggPSAwXG5cbmZ1bmN0aW9uIGNyZWF0ZU5vZGUobm9kZUluZm8pIHtcblx0Y29uc3QgaWQgPSBpZHgrK1xuXG5cdGNvbnN0IGFkamFjZW50Tm9kZXMgPSBuZXcgTWFwKClcblxuXHRmdW5jdGlvbiBnZXROb2RlSW5mbygpIHtcblx0XHRyZXR1cm4gbm9kZUluZm9cblx0fVxuXG5cdGZ1bmN0aW9uIGFkZEFkamFjZW50Tm9kZShlZGdlLCBub2RlKSB7XG5cdFx0YWRqYWNlbnROb2Rlcy5zZXQoZWRnZSwgbm9kZSlcblx0fVxuXG5cdGZ1bmN0aW9uIGdldEFkamFjZW50Tm9kZXMoKSB7XG5cdFx0cmV0dXJuIG5ldyBNYXAoYWRqYWNlbnROb2Rlcylcblx0fVxuXG5cdGZ1bmN0aW9uIGlzTGVhZigpIHtcblx0XHRyZXR1cm4gZmFsc2Vcblx0fVxuXG5cdGZ1bmN0aW9uIGdldElkKCkge1xuXHRcdHJldHVybiBpZFxuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRnZXRJZCxcblx0XHRpc0xlYWYsXG5cdFx0YWRkQWRqYWNlbnROb2RlLFxuXHRcdGdldEFkamFjZW50Tm9kZXMsXG5cdFx0Z2V0Tm9kZUluZm8sXG5cdH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlTGVhZk5vZGUobm9kZUluZm8pIHtcblx0Y29uc3QgaWQgPSBpZHgrK1xuXG5cdGZ1bmN0aW9uIGlzTGVhZigpIHtcblx0XHRyZXR1cm4gdHJ1ZVxuXHR9XG5cdGZ1bmN0aW9uIGdldE5vZGVJbmZvKCkge1xuXHRcdHJldHVybiBub2RlSW5mb1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0SWQoKSB7XG5cdFx0cmV0dXJuIGlkXG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGdldElkLFxuXHRcdGlzTGVhZixcblx0XHRnZXROb2RlSW5mbyxcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0Y3JlYXRlTm9kZSxcblx0Y3JlYXRlTGVhZk5vZGUsXG59XG4iLCJjb25zdCB7IHRyYW5zcG9zZSB9ID0gcmVxdWlyZSgnLi4vLi4vYXJyYXkyZC11dGlscycpXG5jb25zdCB7IGZpbGxNaXNzaW5nVmFsdWVzIH0gPSByZXF1aXJlKCcuL3V0aWxzJylcbmNvbnN0IGNyZWF0ZUNsYXNzaWZpZXIgPSByZXF1aXJlKCcuL2NyZWF0ZUlkM0NsYXNzaWZpZXInKVxuY29uc3QgY29uc3RydWN0SWQzVHJlZSA9IHJlcXVpcmUoJy4vY29uc3RydWN0SWQzVHJlZScpXG5cbmZ1bmN0aW9uIHRyYWluSWQzQ2xhc3NpZmllcihbY29sdW1uTmFtZXMsIC4uLmRhdGFdLCBjb250aW51b3VzQXR0cmlidXRlcyA9IFtdKSB7XG5cdGRhdGEgPSB0cmFuc3Bvc2UoXG5cdFx0dHJhbnNwb3NlKGRhdGEpXG5cdFx0XHQubWFwKChhdHRyUm93LCBpZHgsIHRyYW5zcG9zZWQpID0+IHtcblx0XHRcdFx0aWYgKGlkeCA9PT0gdHJhbnNwb3NlZC5sZW5ndGggLSAxKSByZXR1cm4gYXR0clJvd1xuXHRcdFx0XHRyZXR1cm4gZmlsbE1pc3NpbmdWYWx1ZXMoYXR0clJvdylcblx0XHRcdH0pLFxuXHQpXG5cblx0Y29uc3Qgcm9vdE5vZGUgPSBjb25zdHJ1Y3RJZDNUcmVlKHsgZGF0YSwgY29sdW1uTmFtZXMsIGNvbnRpbnVvdXNBdHRyaWJ1dGVzIH0pXG5cblx0cmV0dXJuIGNyZWF0ZUNsYXNzaWZpZXIoeyByb290Tm9kZSwgY29udGludW91c0F0dHJpYnV0ZXMgfSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB0cmFpbklkM0NsYXNzaWZpZXJcbiIsImNvbnN0IHsgdHJhbnNwb3NlIH0gPSByZXF1aXJlKCcuLi8uLi9hcnJheTJkLXV0aWxzJylcblxuZnVuY3Rpb24gZmlsbE1pc3NpbmdWYWx1ZXMoYXJyYXkpIHtcblx0Y29uc3QgZnJlcU1hcCA9IG5ldyBNYXAoKVxuXG5cdGFycmF5XG5cdFx0LmZpbHRlcih2YWx1ZSA9PiB2YWx1ZSAhPT0gbnVsbClcblx0XHQuZm9yRWFjaCh2YWx1ZSA9PiB7XG5cdFx0XHRjb25zdCBwcmVGcmVxID0gZnJlcU1hcC5oYXModmFsdWUpID8gZnJlcU1hcC5nZXQodmFsdWUpIDogMFxuXHRcdFx0ZnJlcU1hcC5zZXQodmFsdWUsIHByZUZyZXEgKyAxKVxuXHRcdH0pXG5cblx0Y29uc3QgZnJlcUFycmF5ID0gWy4uLmZyZXFNYXAuZW50cmllcygpXVxuXG5cdGNvbnN0IG51bU5vbk1pc3NpbmdWYWx1ZXMgPSBmcmVxQXJyYXkucmVkdWNlKChhY2MsIFssIGZyZXFdKSA9PiBhY2MgKyBmcmVxLCAwKVxuXG5cdGNvbnN0IHByb2JBcnJheSA9IFsuLi5mcmVxQXJyYXldXG5cdFx0LnNvcnQoKFssIGZyZXExXSwgWywgZnJlcTJdKSA9PiBmcmVxMSAtIGZyZXEyKVxuXHRcdC5tYXAoKFt2YWx1ZSwgZnJlcV0pID0+IFt2YWx1ZSwgZnJlcSAvIG51bU5vbk1pc3NpbmdWYWx1ZXNdKVxuXG5cdHByb2JBcnJheS5mb3JFYWNoKChfLCBpZHgpID0+IHtcblx0XHRwcm9iQXJyYXlbaWR4XVsxXSArPSBpZHggPT09IDAgPyAwIDogcHJvYkFycmF5W2lkeCAtIDFdWzFdXG5cdH0pXG5cblx0cmV0dXJuIGFycmF5Lm1hcCh2YWx1ZSA9PiB7XG5cdFx0aWYgKHZhbHVlICE9PSBudWxsKSByZXR1cm4gdmFsdWVcblx0XHRjb25zdCByYW5kID0gTWF0aC5yYW5kb20oKVxuXHRcdHJldHVybiBwcm9iQXJyYXkuZmluZCgoWywgcHJvYl0pID0+IHJhbmQgPD0gcHJvYilbMF1cblx0fSlcbn1cblxuZnVuY3Rpb24gZ2V0QXR0cmlidXRlVmFsdWVzU3VtbWFyeShhcnJheTJkKSB7XG5cdC8qXG5cdFtcblx0XHR7YXR0cjFWMTogW24sIHBdLCBhdHRyMVYyOiBbbiwgcF0sIGF0dHIxVjM6IFtuLCBwXX0sXG5cdFx0e2F0dHIyVjE6IFtuLCBwXSwgYXR0cjJWMjogW24sIHBdLCBhdHRyMlYzOiBbbiwgcF19LFxuXHRcdC4uXG5cdF1cblx0Ki9cblx0cmV0dXJuIHRyYW5zcG9zZShhcnJheTJkKVxuXHRcdC5tYXAoKGF0dHJSb3csIF8sIHRyYW5zcG9zZWRBcnIpID0+IFthdHRyUm93LCB0cmFuc3Bvc2VkQXJyLmF0KC0xKV0pXG5cdFx0Lm1hcCh0cmFuc3Bvc2UpXG5cdFx0Lm1hcChhdHRyRGVjaXNpb24gPT4gYXR0ckRlY2lzaW9uLnJlZHVjZSgobWFwLCBbYXR0clZhbCwgZGVjaXNpb25dKSA9PiB7XG5cdFx0XHRpZiAoIW1hcC5oYXMoYXR0clZhbCkpIG1hcC5zZXQoYXR0clZhbCwgWzAsIDBdKVxuXHRcdFx0bWFwLmdldChhdHRyVmFsKVtkZWNpc2lvbl0rK1xuXHRcdFx0cmV0dXJuIG1hcFxuXHRcdH0sIG5ldyBNYXAoKSkpXG59XG5cbmZ1bmN0aW9uIGNhbGNFbnRyb3B5KG4sIHApIHtcblx0aWYgKHAgPT09IDAgfHwgbiA9PT0gMCkgcmV0dXJuIDBcblx0cmV0dXJuIC0ocCAvIChwICsgbikpICogTWF0aC5sb2cyKHAgLyAocCArIG4pKSAtIChuIC8gKHAgKyBuKSkgKiBNYXRoLmxvZzIobiAvIChwICsgbikpXG59XG5cbmZ1bmN0aW9uIGNhbGNNYXRyaXhJbmZvR2FpbihhcnJheTJkKSB7XG5cdGNvbnN0IG51bVNhbXBsZXMgPSBhcnJheTJkLmxlbmd0aFxuXG5cdGNvbnN0IGF0dHJpYnV0ZVZhbHVlc1N1bW1hcnkgPSBnZXRBdHRyaWJ1dGVWYWx1ZXNTdW1tYXJ5KGFycmF5MmQpXG5cblx0Y29uc3QgZGF0YUVudHJvcHkgPSBjYWxjRW50cm9weShcblx0XHRhdHRyaWJ1dGVWYWx1ZXNTdW1tYXJ5LmF0KC0xKS5nZXQoMClbMF0sXG5cdFx0YXR0cmlidXRlVmFsdWVzU3VtbWFyeS5hdCgtMSkuZ2V0KDEpWzFdLFxuXHQpXG5cblx0Y29uc3QgaW5mb0VudHJvcGllcyA9IGF0dHJpYnV0ZVZhbHVlc1N1bW1hcnlcblx0XHQuc2xpY2UoMCwgLTEpXG5cdFx0Lm1hcChhdHRyTWFwID0+IChcblx0XHRcdFsuLi5hdHRyTWFwLnZhbHVlcygpXS5yZWR1Y2UoKGFjYywgW24sIHBdKSA9PiBhY2MgKyAoY2FsY0VudHJvcHkobiwgcCkgKiAobiArIHApKSAvIG51bVNhbXBsZXMsIDApXG5cdFx0KSlcblxuXHRyZXR1cm4gaW5mb0VudHJvcGllcy5tYXAoaWUgPT4gZGF0YUVudHJvcHkgLSBpZSlcbn1cbmZ1bmN0aW9uIGNhbGNDb250aW51b3VzVGhyZXNob2xkVmFsdWUodmFsdWVzQXJyYXksIGRlY2lzaW9ucykge1xuXHRjb25zdCBzb3J0ZWRVbmlxdWVWYWx1ZXMgPSBbLi4ubmV3IFNldCh2YWx1ZXNBcnJheSldLnNvcnQoKGEsIGIpID0+IGEgLSBiKVxuXG5cdGNvbnNvbGUuYXNzZXJ0KHNvcnRlZFVuaXF1ZVZhbHVlcy5sZW5ndGggPj0gMilcblxuXHRyZXR1cm4gc29ydGVkVW5pcXVlVmFsdWVzXG5cdFx0LnJlZHVjZSgoYmVzdCwgXywgaWR4KSA9PiB7XG5cdFx0XHRpZiAoaWR4ID09PSAwKSByZXR1cm4gbnVsbFxuXG5cdFx0XHRjb25zdCB0aHJlc2hvbGQgPSAoc29ydGVkVW5pcXVlVmFsdWVzW2lkeF0gKyBzb3J0ZWRVbmlxdWVWYWx1ZXNbaWR4IC0gMV0pIC8gMlxuXHRcdFx0Y29uc3QgW2luZm9HYWluXSA9IGNhbGNNYXRyaXhJbmZvR2Fpbih0cmFuc3Bvc2UoW3ZhbHVlc0FycmF5Lm1hcCh2YWx1ZSA9PiB2YWx1ZSA+IHRocmVzaG9sZCksIGRlY2lzaW9uc10pKVxuXG5cdFx0XHRpZiAoYmVzdCA9PT0gbnVsbCB8fCBpbmZvR2FpbiA+IGJlc3QuaW5mb0dhaW4pIHJldHVybiB7IHRocmVzaG9sZCwgaW5mb0dhaW4gfVxuXG5cdFx0XHRyZXR1cm4gYmVzdFxuXHRcdH0sIG51bGwpXG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRjYWxjQ29udGludW91c1RocmVzaG9sZFZhbHVlLFxuXHRjYWxjRW50cm9weSxcblx0Y2FsY01hdHJpeEluZm9HYWluLFxuXHRmaWxsTWlzc2luZ1ZhbHVlcyxcblx0Z2V0QXR0cmlidXRlVmFsdWVzU3VtbWFyeSxcbn1cbiIsImZ1bmN0aW9uIHBhcnRpdGlvbjJkQXJyYXkoYXJyYXkyZCwgY29sdW1uSWR4KSB7XG5cdGNvbnN0IG51bUNvbHVtbnMgPSBhcnJheTJkWzBdLmxlbmd0aFxuXHRjb2x1bW5JZHggPSAoKGNvbHVtbklkeCAlIG51bUNvbHVtbnMpICsgbnVtQ29sdW1ucykgJSBudW1Db2x1bW5zXG5cblx0cmV0dXJuIGFycmF5MmQucmVkdWNlKChwYXJ0cywgcm93KSA9PiB7XG5cdFx0Y29uc3QgdGFyZ2V0Q29sdW1uVmFsdWUgPSByb3dbY29sdW1uSWR4XVxuXG5cdFx0aWYgKCFwYXJ0cy5oYXModGFyZ2V0Q29sdW1uVmFsdWUpKSBwYXJ0cy5zZXQodGFyZ2V0Q29sdW1uVmFsdWUsIFtdKVxuXG5cdFx0cGFydHMuZ2V0KHRhcmdldENvbHVtblZhbHVlKS5wdXNoKFsuLi5yb3cuc2xpY2UoMCwgY29sdW1uSWR4KSwgLi4ucm93LnNsaWNlKGNvbHVtbklkeCArIDEpXSlcblxuXHRcdHJldHVybiBwYXJ0c1xuXHR9LCBuZXcgTWFwKCkpXG59XG5cbmZ1bmN0aW9uIHRyYW5zcG9zZShhcnJheSkge1xuXHRjb25zdCByb3dzID0gYXJyYXkubGVuZ3RoXG5cblx0aWYgKHJvd3MgPT09IDApIHJldHVybiBbXVxuXG5cdGNvbnN0IGNvbHMgPSBhcnJheVswXS5sZW5ndGhcblxuXHRpZiAoY29scyA9PT0gdW5kZWZpbmVkKSByZXR1cm4gdHJhbnNwb3NlKFthcnJheV0pXG5cblx0Y29uc3QgcmV0ID0gbmV3IEFycmF5KGNvbHMpLmZpbGwobnVsbCkubWFwKCgpID0+IG5ldyBBcnJheShyb3dzKS5maWxsKG51bGwpKVxuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgcm93czsgaSsrKSB7XG5cdFx0Zm9yIChsZXQgaiA9IDA7IGogPCBjb2xzOyBqKyspIHtcblx0XHRcdHJldFtqXVtpXSA9IGFycmF5W2ldW2pdXG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHJldFxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0cGFydGl0aW9uMmRBcnJheSxcblx0dHJhbnNwb3NlLFxufVxuIiwiZnVuY3Rpb24gbW92ZURlY2lzaW9uQXR0cmlidXRlVG9MYXN0Q29sdW1uKGRhdGEsIGF0dHJpYnV0ZXMsIGRlY2lzaW9uQXR0cmlidXRlKSB7XG5cdGNvbnN0IGogPSBhdHRyaWJ1dGVzLmZpbmRJbmRleChhdHRyID0+IGF0dHIgPT09IGRlY2lzaW9uQXR0cmlidXRlKVxuXG5cdGNvbnN0IG4gPSBhdHRyaWJ1dGVzLmxlbmd0aFxuXG5cdGlmIChqID09PSBuIC0gMSkgcmV0dXJuIHsgZGF0YSwgYXR0cmlidXRlcyB9XG5cblx0ZGF0YSA9IFsuLi5kYXRhXVxuXHRhdHRyaWJ1dGVzID0gWy4uLmRhdGFdXG5cblx0O1tkYXRhW2pdLCBkYXRhW24gLSAxXV0gPSBbZGF0YVtuIC0gMV0sIGRhdGFbal1dXG5cdDtbYXR0cmlidXRlc1tqXSwgYXR0cmlidXRlc1tuIC0gMV1dID0gW2F0dHJpYnV0ZXNbbiAtIDFdLCBhdHRyaWJ1dGVzW2pdXVxuXG5cdHJldHVybiB7IGRhdGEsIGF0dHJpYnV0ZXMgfVxufVxuXG5mdW5jdGlvbiByZXBsYWNlTWlzc2luZ0RhdGEoZGF0YSwgbWlzc2luZ0RhdGFWYWx1ZXMpIHtcblx0cmV0dXJuIGRhdGEubWFwKHJvdyA9PiByb3cubWFwKHZhbHVlID0+IChtaXNzaW5nRGF0YVZhbHVlcy5pbmNsdWRlcyh2YWx1ZSkgPyBudWxsIDogdmFsdWUpKSlcbn1cblxuZnVuY3Rpb24gY2FzdENvbHVtbnNUb051bWJlcihkYXRhLCBjb2x1bW5JbmRleGVzKSB7XG5cdHJldHVybiBkYXRhLm1hcChyb3cgPT4ge1xuXHRcdHJvdyA9IFsuLi5yb3ddXG5cdFx0Y29sdW1uSW5kZXhlcy5mb3JFYWNoKGNvbElkeCA9PiB7XG5cdFx0XHRyb3dbY29sSWR4XSA9IE51bWJlcihyb3dbY29sSWR4XSlcblx0XHR9KVxuXHRcdHJldHVybiByb3dcblx0fSlcbn1cblxuZnVuY3Rpb24gcmVwbGFjZURlY2lzaW9uQXR0cmlidXRlc1dpdGgwKGRhdGEsIHBvc2l0aXZlVmFsdWVzKSB7XG5cdHJldHVybiBkYXRhLm1hcChyb3cgPT4ge1xuXHRcdHJvdyA9IFsuLi5yb3ddXG5cdFx0Y29uc3QgdmFsdWUgPSByb3dbcm93Lmxlbmd0aCAtIDFdXG5cdFx0cm93W3Jvdy5sZW5ndGggLSAxXSA9IHZhbHVlID09PSBwb3NpdGl2ZVZhbHVlcyA/IDEgOiAwXG5cdFx0cmV0dXJuIHJvd1xuXHR9KVxufVxuXG5mdW5jdGlvbiBwcmVwYXJlRGF0YSh7XG5cdGRhdGE6IG9yaWdEYXRhLFxuXHRkZWNpc2lvbkF0dHJpYnV0ZSxcblx0bWlzc2luZ0RhdGFWYWx1ZXMsXG5cdGNvbnRpbnVvc0F0dHJpYnV0ZXMsXG5cdHBvc2l0aXZlRGVjaXNpb25WYWx1ZSxcblx0cmVuYW1lRGVjaXNpb25UbyA9IG51bGwsXG59KSB7XG5cdGxldCBhdHRyaWJ1dGVzID0gb3JpZ0RhdGFbMF1cblx0bGV0IGRhdGEgPSBvcmlnRGF0YS5zbGljZSgxKVxuXG5cdDsoeyBkYXRhLCBhdHRyaWJ1dGVzIH0gPSBtb3ZlRGVjaXNpb25BdHRyaWJ1dGVUb0xhc3RDb2x1bW4oZGF0YSwgYXR0cmlidXRlcywgZGVjaXNpb25BdHRyaWJ1dGUpKVxuXHRkYXRhID0gcmVwbGFjZU1pc3NpbmdEYXRhKGRhdGEsIG1pc3NpbmdEYXRhVmFsdWVzKVxuXG5cdGNvbnN0IGNvbnRpbnVvc0F0dHJpYnV0ZXNJbmRleGVzID0gY29udGludW9zQXR0cmlidXRlcy5tYXAoYXR0ciA9PiBhdHRyaWJ1dGVzLmZpbmRJbmRleCh2ID0+IHYgPT09IGF0dHIpKVxuXHRkYXRhID0gY2FzdENvbHVtbnNUb051bWJlcihkYXRhLCBjb250aW51b3NBdHRyaWJ1dGVzSW5kZXhlcylcblxuXHRkYXRhID0gcmVwbGFjZURlY2lzaW9uQXR0cmlidXRlc1dpdGgwKGRhdGEsIHBvc2l0aXZlRGVjaXNpb25WYWx1ZSlcblxuXHRpZiAocmVuYW1lRGVjaXNpb25UbykgYXR0cmlidXRlc1thdHRyaWJ1dGVzLmxlbmd0aCAtIDFdID0gcmVuYW1lRGVjaXNpb25Ub1xuXG5cdHJldHVybiB7IGRhdGEsIGF0dHJpYnV0ZXMgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHByZXBhcmVEYXRhXG4iLCJtb2R1bGUuZXhwb3J0cyA9IFtbXCJhZ2VcIixcImNoZXN0X3BhaW5fdHlwZVwiLFwicmVzdF9ibG9vZF9wcmVzc3VyZVwiLFwiYmxvb2Rfc3VnYXJcIixcInJlc3RfZWxlY3Ryb1wiLFwibWF4X2hlYXJ0X3JhdGVcIixcImV4ZXJjaWNlX2FuZ2luYVwiLFwiZGlzZWFzZVwiXSxbXCI0M1wiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzNVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzOVwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTYwXCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjM5XCIsXCJub25fYW5naW5hbFwiLFwiMTYwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjE2MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQyXCIsXCJub25fYW5naW5hbFwiLFwiMTYwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDZcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OVwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUwXCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTM1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTlcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJUUlVFXCIsXCJsZWZ0X3ZlbnRfaHlwZXJcIixcIjExOVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NFwiLFwiYXN5bXB0XCIsXCIyMDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MlwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1OVwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyNVwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjU2XCIsXCJhc3ltcHRcIixcIjE3MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTIyXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjUyXCIsXCJub25fYW5naW5hbFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxNzBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI2MFwiLFwiYXN5bXB0XCIsXCIxMDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyNVwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjU1XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTYwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjE0M1wiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1N1wiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCIxNDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzOFwiLFwiYXN5bXB0XCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2NlwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjYwXCIsXCJub25fYW5naW5hbFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibGVmdF92ZW50X2h5cGVyXCIsXCIxMzVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NVwiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTBcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxNDBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDhcIixcImFzeW1wdFwiLFwiMTA2XCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjExMFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjM5XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTkwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMDZcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI2NlwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjk0XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU2XCIsXCJhc3ltcHRcIixcIjE1NVwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDRcIixcImFzeW1wdFwiLFwiMTM1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzVcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI0M1wiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyMFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NFwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExOFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1MlwiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTM4XCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjQ4XCIsXCJhc3ltcHRcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTE1XCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTFcIixcIm5vbl9hbmdpbmFsXCIsXCIxMzVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjU5XCIsXCJub25fYW5naW5hbFwiLFwiMTgwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1OFwiLFwiYXR5cF9hbmdpbmFcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTEwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDZcIixcImFzeW1wdFwiLFwiMTE4XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjRcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NFwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjkxXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQ4XCIsXCJhc3ltcHRcIixcIjE2MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiOTJcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzhcIixcImFzeW1wdFwiLFwiMTEwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzlcIixcImF0eXBfYW5naW5hXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ2XCIsXCJhc3ltcHRcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTE1XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjMzXCIsXCJub25fYW5naW5hbFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxODVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MFwiLFwiYXN5bXB0XCIsXCIxNDVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQxXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTI1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDRcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OVwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI2NVwiLFwiYXN5bXB0XCIsXCIxNzBcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTEyXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjUwXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI2NVwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiODdcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDZcIixcInR5cF9hbmdpbmFcIixcIjE0MFwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCIxNzVcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI0MFwiLFwibm9uX2FuZ2luYWxcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTg4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzlcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0NVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU0XCIsXCJhc3ltcHRcIixcIjEyNVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNDhcIixcIm5vbl9hbmdpbmFsXCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzOFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU1XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTMwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQ0XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTZcIixcIm5vbl9hbmdpbmFsXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExNFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjMyXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTEwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxODRcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NVwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCIxMzdcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NFwiLFwibm9uX2FuZ2luYWxcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTIyXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTFcIixcImF0eXBfYW5naW5hXCIsXCIxMjVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0NVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ3XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTYwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzRcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1N1wiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTQ1XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQzXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQyXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzhcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NVwiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCIxMjJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1M1wiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTYyXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDZcIixcIm5vbl9hbmdpbmFsXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU2XCIsXCJub25fYW5naW5hbFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjhcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiNDhcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExOFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU1XCIsXCJ0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCI/XCIsXCIxMzZcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI0OVwiLFwibm9uX2FuZ2luYWxcIixcIjExNVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTc1XCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTZcIixcImFzeW1wdFwiLFwiMTUwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMjRcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzlcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE0NlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUyXCIsXCJhc3ltcHRcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTNcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDhcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NVwiLFwibm9uX2FuZ2luYWxcIixcIjEyMFwiLFwiRkFMU0VcIixcImxlZnRfdmVudF9oeXBlclwiLFwiMTM0XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDZcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTJcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCIzNlwiLFwibm9uX2FuZ2luYWxcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTc4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTNcIixcIm5vbl9hbmdpbmFsXCIsXCIxNDVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzMFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjM0XCIsXCJhdHlwX2FuZ2luYVwiLFwiOThcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjMxXCIsXCJhc3ltcHRcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUzXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjI5XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NlwiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTY1XCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjI5XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0M1wiLFwiYXN5bXB0XCIsXCIxNTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzMFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0OVwiLFwiYXN5bXB0XCIsXCIxNTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyMlwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjM5XCIsXCJhc3ltcHRcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiMzhcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NFwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTU0XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDBcIixcImF0eXBfYW5naW5hXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjMyXCIsXCJhc3ltcHRcIixcIjExOFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTMwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTVcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTBcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiNDJcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1NVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ4XCIsXCJhc3ltcHRcIixcIjE2MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTAzXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQ1XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQ0XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTNcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzMlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjM5XCIsXCJhc3ltcHRcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTMyXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDFcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMzBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI0MlwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDlcIixcImF0eXBfYW5naW5hXCIsXCIxMDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3NFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU0XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTYwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMzBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1OFwiLFwibm9uX2FuZ2luYWxcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTYwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMjhcIixcImF0eXBfYW5naW5hXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJsZWZ0X3ZlbnRfaHlwZXJcIixcIjE4NVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ2XCIsXCJhc3ltcHRcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjUxXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OFwiLFwiYXN5bXB0XCIsXCIxNjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEwMlwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1MVwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEwMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQyXCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTcwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDhcIixcImFzeW1wdFwiLFwiMTYwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCI5OVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzMlwiLFwiYXR5cF9hbmdpbmFcIixcIjEyNVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTU1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTVcIixcIm5vbl9hbmdpbmFsXCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUzXCIsXCJhc3ltcHRcIixcIjEyNFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTEyXCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjQ2XCIsXCJhc3ltcHRcIixcIjE4MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTIwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTVcIixcImF0eXBfYW5naW5hXCIsXCIxNDVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1NVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ2XCIsXCJhc3ltcHRcIixcIjExMFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTQwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDlcIixcImFzeW1wdFwiLFwiMTI4XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCI5NlwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzNVwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcImxlZnRfdmVudF9oeXBlclwiLFwiMTgwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzVcIixcImF0eXBfYW5naW5hXCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjU0XCIsXCJub25fYW5naW5hbFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzdcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1OFwiLFwiYXR5cF9hbmdpbmFcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDlcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTJcIixcImF0eXBfYW5naW5hXCIsXCIxNjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2NVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ4XCIsXCJhc3ltcHRcIixcIjEyMlwiLFwiVFJVRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxNTBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNjJcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQxXCIsXCJhc3ltcHRcIixcIjExMlwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQyXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTJcIixcImFzeW1wdFwiLFwiMTYwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCI4MlwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0MFwiLFwibm9uX2FuZ2luYWxcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTM4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTJcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzlcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzNFwiLFwidHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxODBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI0MFwiLFwibm9uX2FuZ2luYWxcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTY3XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDdcIixcImFzeW1wdFwiLFwiMTYwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxNThcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDdcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjEyNVwiLFwieWVzXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NlwiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQwXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MlwiLFwiYXN5bXB0XCIsXCIxNjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjk0XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU0XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTEwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NFwiLFwiYXR5cF9hbmdpbmFcIixcIjE2MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTc1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTNcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTZcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTBcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjFcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTVcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0N1wiLFwiYXN5bXB0XCIsXCIxNTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjk4XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM2XCIsXCJub25fYW5naW5hbFwiLFwiMTEyXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxODRcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI2NVwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjExNVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzN1wiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzMFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NFwiLFwidHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzdcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzNlwiLFwibm9uX2FuZ2luYWxcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTcyXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDdcIixcIm5vbl9hbmdpbmFsXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0NVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzNlwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTgwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTJcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzRcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDFcIixcImFzeW1wdFwiLFwiMTEwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI0MlwiLFwibm9uX2FuZ2luYWxcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUyXCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjM3XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTMwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCI5OFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU4XCIsXCJub25fYW5naW5hbFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxNDBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1MFwiLFwiYXN5bXB0XCIsXCIxNTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwieWVzXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OFwiLFwiYXR5cF9hbmdpbmFcIixcIjEwMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTAwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNThcIixcImFzeW1wdFwiLFwiMTM1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1OFwiLFwiYXR5cF9hbmdpbmFcIixcIjEzNlwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiOTlcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDRcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjM4XCIsXCJub25fYW5naW5hbFwiLFwiMTQ1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NFwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTEwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDZcIixcImFzeW1wdFwiLFwiMTEwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxNDBcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiNTRcIixcIm5vbl9hbmdpbmFsXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NlwiLFwiYXN5bXB0XCIsXCIxNTBcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTI1XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjUzXCIsXCJub25fYW5naW5hbFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI2MVwiLFwiYXN5bXB0XCIsXCIxMjVcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjExNVwiLFwieWVzXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OVwiLFwibm9uX2FuZ2luYWxcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTcyXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTBcIixcImF0eXBfYW5naW5hXCIsXCIxNzBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjExNlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ1XCIsXCJub25fYW5naW5hbFwiLFwiMTM1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MlwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyNFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1MFwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjEyNVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0M1wiLFwidHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxNTVcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCIzOFwiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTNcIixcImFzeW1wdFwiLFwiMTgwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMjBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTdcIixcImFzeW1wdFwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCI5MlwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1OVwiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTRcIixcImFzeW1wdFwiLFwiMTI1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjJcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCIzOVwiLFwibm9uX2FuZ2luYWxcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTcwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTBcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUyXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMThcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NFwiLFwiYXN5bXB0XCIsXCIxNTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjM2XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI0NFwiLFwiYXR5cF9hbmdpbmFcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTM1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDZcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjVcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDFcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMThcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDVcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NVwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjEzMFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1MlwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExMFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NVwiLFwiYXN5bXB0XCIsXCIxNDVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjk2XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM3XCIsXCJub25fYW5naW5hbFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0MVwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTcwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzdcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNThcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NFwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEwMFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0MlwiLFwiYXR5cF9hbmdpbmFcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTM2XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDFcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE2MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU5XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzRcIixcImF0eXBfYW5naW5hXCIsXCIxNTBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE2OFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUyXCIsXCJhc3ltcHRcIixcIjE3MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTI2XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU2XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzOFwiLFwiYXN5bXB0XCIsXCI5MlwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTM0XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU0XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTA1XCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNDhcIixcImF0eXBfYW5naW5hXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU4XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU0XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCIxMjVcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzVcIixcImF0eXBfYW5naW5hXCIsXCIxNTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2OFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU4XCIsXCJub25fYW5naW5hbFwiLFwiMTYwXCIsXCJUUlVFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjkyXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTVcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjhcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzdcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjhcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NFwiLFwiYXN5bXB0XCIsXCIxNTBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjEzNFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ3XCIsXCJ0eXBfYW5naW5hXCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjYzXCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTE1XCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTlcIixcIm5vbl9hbmdpbmFsXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyMFwiLFwieWVzXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MlwiLFwiYXN5bXB0XCIsXCIxMTJcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjk2XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQ5XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTcwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTNcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXV0iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZ2V0RGVmYXVsdEV4cG9ydCBmdW5jdGlvbiBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIG5vbi1oYXJtb255IG1vZHVsZXNcbl9fd2VicGFja19yZXF1aXJlX18ubiA9IChtb2R1bGUpID0+IHtcblx0dmFyIGdldHRlciA9IG1vZHVsZSAmJiBtb2R1bGUuX19lc01vZHVsZSA/XG5cdFx0KCkgPT4gKG1vZHVsZVsnZGVmYXVsdCddKSA6XG5cdFx0KCkgPT4gKG1vZHVsZSk7XG5cdF9fd2VicGFja19yZXF1aXJlX18uZChnZXR0ZXIsIHsgYTogZ2V0dGVyIH0pO1xuXHRyZXR1cm4gZ2V0dGVyO1xufTsiLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiaW1wb3J0IGNyZWF0ZUlkM0NsYXNzaWZpZXIgZnJvbSAnLi4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9pZDMnXG5pbXBvcnQgcHJlcGFyZURhdGEgZnJvbSAnLi4vZGF0YS1taW5pbmcvcHJlcGFyZURhdGEnXG5pbXBvcnQgY3JlYXRlQmF5ZXNDbGFzc2lmaWVyIGZyb20gJy4uL2RhdGEtbWluaW5nL2FsZ29yaXRobXMvYmF5ZXMnXG5pbXBvcnQgZGF0YXNldCBmcm9tICcuLi9kYXRhLW1pbmluZy9oZWFydF9kaXNlYXNlX21hbGUuY3N2J1xuXG5jb25zdCBjb250aW51b3NBdHRyaWJ1dGVzID0gWydhZ2UnLCAncmVzdF9ibG9vZF9wcmVzc3VyZScsICdtYXhfaGVhcnRfcmF0ZSddXG5cbmNvbnN0IHsgZGF0YTogdHJhaW5EYXRhLCBhdHRyaWJ1dGVzIH0gPSBwcmVwYXJlRGF0YSh7XG5cdGRhdGE6IGRhdGFzZXQsXG5cdGNvbnRpbnVvc0F0dHJpYnV0ZXMsXG5cdGRlY2lzaW9uQXR0cmlidXRlOiAnZGlzZWFzZScsXG5cdG1pc3NpbmdEYXRhVmFsdWVzOiBbJz8nLCAnJ10sXG5cdHBvc2l0aXZlRGVjaXNpb25WYWx1ZTogJ3Bvc2l0aXZlJyxcblx0cmVuYW1lRGVjaXNpb25UbzogJ2RlY2lzaW9uJyxcbn0pXG5cbnRyYWluRGF0YS51bnNoaWZ0KGF0dHJpYnV0ZXMuc2xpY2UoKSlcblxuY29uc3QgaWQzQ2xhc3NpZmllciA9IGNyZWF0ZUlkM0NsYXNzaWZpZXIodHJhaW5EYXRhLCBjb250aW51b3NBdHRyaWJ1dGVzKVxuY29uc3QgYmF5ZXNDbGFzc2lmaWVyID0gY3JlYXRlQmF5ZXNDbGFzc2lmaWVyKHRyYWluRGF0YSwgY29udGludW9zQXR0cmlidXRlcylcblxuY29uc3QgZm9ybSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2Zvcm0nKVxuY29uc3QgcmVzdWx0RWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcucmVzdWx0JylcbmNvbnN0IHJlc3VsdEljb24gPSByZXN1bHRFbC5xdWVyeVNlbGVjdG9yKCcucmVzdWx0LWljb24nKVxuXG5yZXN1bHRJY29uLmFkZEV2ZW50TGlzdGVuZXIoJ2FuaW1hdGlvbmVuZCcsICgpID0+IHtcblx0cmVzdWx0SWNvbi5jbGFzc0xpc3QucmVtb3ZlKCdhbmltYXRlJylcbn0pXG5cbmZvcm0uYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7XG5cdHJlc3VsdEVsLmNsYXNzTGlzdC5yZW1vdmUoJ3Nob3cnKVxuXHRyZXN1bHRJY29uLmNsYXNzTGlzdC5yZW1vdmUoJ2FuaW1hdGUnKVxufSlcblxuZm9ybS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCBlID0+IHtcblx0ZS5wcmV2ZW50RGVmYXVsdCgpXG5cdGNvbnN0IGVudHJpZXMgPSBbLi4ubmV3IEZvcm1EYXRhKGZvcm0pXVxuXHRcdC5maWx0ZXIoKFssIHZhbHVlXSkgPT4gdmFsdWUgIT09ICcnKVxuXHRcdC5tYXAoKFthdHRyLCB2YWx1ZV0pID0+IHtcblx0XHRcdGlmICghY29udGludW9zQXR0cmlidXRlcy5pbmNsdWRlcyhhdHRyKSkgcmV0dXJuIFthdHRyLCB2YWx1ZV1cblx0XHRcdHJldHVybiBbYXR0ciwgTnVtYmVyKHZhbHVlKV1cblx0XHR9KVxuXHRjb25zdCBkYXRhT2JqZWN0ID0gT2JqZWN0LmZyb21FbnRyaWVzKGVudHJpZXMpXG5cdGNvbnNvbGUubG9nKGRhdGFPYmplY3QpXG5cblx0bGV0IHJlc3VsdFxuXG5cdGlmIChkYXRhT2JqZWN0LmFsZ29yaXRobSA9PT0gJ2lkMycpIHtcblx0XHRyZXN1bHQgPSBpZDNDbGFzc2lmaWVyLmNsYXNzaWZ5KGRhdGFPYmplY3QpXG5cdH0gZWxzZSB7XG5cdFx0cmVzdWx0ID0gYmF5ZXNDbGFzc2lmaWVyLmNsYXNzaWZ5KGRhdGFPYmplY3QpXG5cdH1cblxuXHRjb25zb2xlLmxvZyhyZXN1bHQpXG5cdGNvbnN0IHsgZGVjaXNpb24gfSA9IHJlc3VsdFxuXHRyZXN1bHRFbC5jbGFzc0xpc3QucmVtb3ZlKCdwb3NpdGl2ZScsICduZWdhdGl2ZScpXG5cdHJlc3VsdEVsLmNsYXNzTGlzdC5hZGQoJ3Nob3cnLCBbJ25lZ2F0aXZlJywgJ3Bvc2l0aXZlJ11bZGVjaXNpb25dKVxuXHRyZXN1bHRJY29uLmNsYXNzTGlzdC5hZGQoJ2FuaW1hdGUnKVxufSlcbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==