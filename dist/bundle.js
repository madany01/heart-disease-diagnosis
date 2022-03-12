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
const { getAttributeValuesFrequencies, calcMatrixInfoGain, calcContinuousThresholdValue } = __webpack_require__(/*! ./utils */ "./data-mining/algorithms/id3/utils.js")

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

		const [attrValuesMap] = getAttributeValuesFrequencies(discreteData)

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

function getAttributeValuesFrequencies(array2d) {
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

	const attributeValuesFreqs = getAttributeValuesFrequencies(array2d)

	const dataEntropy = calcEntropy(
		attributeValuesFreqs.at(-1).get(0)[0],
		attributeValuesFreqs.at(-1).get(1)[1],
	)

	const infoEntropies = attributeValuesFreqs
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
			const [infoGain] = calcMatrixInfoGain(transpose([valuesArray.map(value => value <= threshold), decisions]))

			if (best === null || infoGain > best.infoGain) return { threshold, infoGain }

			return best
		}, null)
}

module.exports = {
	calcContinuousThresholdValue,
	calcEntropy,
	calcMatrixInfoGain,
	fillMissingValues,
	getAttributeValuesFrequencies,
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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R0FBRztBQUNIO0FBQ0E7O0FBRUE7QUFDQSxTQUFTLFdBQVc7QUFDcEI7QUFDQTtBQUNBO0FBQ0EsQ0FBQyIsInNvdXJjZXMiOlsid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvLi9kYXRhLW1pbmluZy9hbGdvcml0aG1zL2JheWVzL2NyZWF0ZUJheWVzQ2xhc3NpZmllci5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9iYXllcy9pbmRleC5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9iYXllcy91dGlscy5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9pZDMvY29uc3RydWN0SWQzVHJlZS5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9pZDMvY3JlYXRlSWQzQ2xhc3NpZmllci5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvYWxnb3JpdGhtcy9pZDMvZ3JhcGguanMiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL2RhdGEtbWluaW5nL2FsZ29yaXRobXMvaWQzL2luZGV4LmpzIiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvLi9kYXRhLW1pbmluZy9hbGdvcml0aG1zL2lkMy91dGlscy5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvYXJyYXkyZC11dGlscy9pbmRleC5qcyIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zLy4vZGF0YS1taW5pbmcvcHJlcGFyZURhdGEuanMiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL2RhdGEtbWluaW5nL2hlYXJ0X2Rpc2Vhc2VfbWFsZS5jc3YiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zL3dlYnBhY2svcnVudGltZS9jb21wYXQgZ2V0IGRlZmF1bHQgZXhwb3J0Iiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL2RhdGEtbWluaW5nLWFsZ29yaXRobXMvd2VicGFjay9ydW50aW1lL2hhc093blByb3BlcnR5IHNob3J0aGFuZCIsIndlYnBhY2s6Ly9kYXRhLW1pbmluZy1hbGdvcml0aG1zL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vZGF0YS1taW5pbmctYWxnb3JpdGhtcy8uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB7IGNhbGNHYXVzc2lhbkRlbnNpdHkgfSA9IHJlcXVpcmUoJy4vdXRpbHMnKVxuXG5mdW5jdGlvbiBjcmVhdGVCYXllc0NsYXNzaWZpZXIoe1xuXHRkZWNpc2lvbnNGcmVxcyxcblx0ZGlzY3JldGVBdHRyaWJ1dGVzRnJlcXMsXG5cdGNvbnRpbnVvc0F0dHJpYnV0ZXNTdGF0cyxcbn0pIHtcblx0Y29uc3QgZGVjaXNpb25zRnJlcXNTdW0gPSBkZWNpc2lvbnNGcmVxcy5yZWR1Y2UoKGFjYywgZnJlcSkgPT4gYWNjICsgZnJlcSwgMClcblx0Y29uc3QgW1AwLCBQMV0gPSBkZWNpc2lvbnNGcmVxcy5tYXAoZnJlcSA9PiBmcmVxIC8gZGVjaXNpb25zRnJlcXNTdW0pXG5cblx0ZnVuY3Rpb24gZ2V0RGlzY3JldGVBdHRyc1Byb2JzKG9iamVjdCkge1xuXHRcdHJldHVybiBPYmplY3Rcblx0XHRcdC5lbnRyaWVzKG9iamVjdClcblx0XHRcdC5maWx0ZXIoKFthdHRyLCB2YWx1ZV0pID0+IChcblx0XHRcdFx0ZGlzY3JldGVBdHRyaWJ1dGVzRnJlcXMuaGFzKGF0dHIpICYmIGRpc2NyZXRlQXR0cmlidXRlc0ZyZXFzLmdldChhdHRyKS5oYXModmFsdWUpXG5cdFx0XHQpKVxuXHRcdFx0LnJlZHVjZShcblx0XHRcdFx0KHByb2JzLCBbYXR0ciwgdmFsdWVdKSA9PiB7XG5cdFx0XHRcdFx0cHJvYnMuZm9yRWFjaCgoXywgaWR4KSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBhdHRyRnJlcU1hcCA9IGRpc2NyZXRlQXR0cmlidXRlc0ZyZXFzLmdldChhdHRyKVxuXHRcdFx0XHRcdFx0Y29uc3QgbnVtVW5pcXVlVmFsdWVzID0gYXR0ckZyZXFNYXAuc2l6ZVxuXHRcdFx0XHRcdFx0cHJvYnNbaWR4XSAqPSAoYXR0ckZyZXFNYXAuZ2V0KHZhbHVlKVtpZHhdICsgMSkgLyAoZGVjaXNpb25zRnJlcXNbaWR4XSArIG51bVVuaXF1ZVZhbHVlcylcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdHJldHVybiBwcm9ic1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRbMSwgMV0sXG5cdFx0XHQpXG5cdH1cblxuXHRmdW5jdGlvbiBnZXRDb250aW51b3VzQXR0cnNQcm9icyhvYmplY3QpIHtcblx0XHRyZXR1cm4gT2JqZWN0XG5cdFx0XHQuZW50cmllcyhvYmplY3QpXG5cdFx0XHQuZmlsdGVyKChbYXR0cl0pID0+IGNvbnRpbnVvc0F0dHJpYnV0ZXNTdGF0cy5oYXMoYXR0cikpXG5cdFx0XHQucmVkdWNlKFxuXHRcdFx0XHQocHJvYnMsIFthdHRyLCB2YWx1ZV0pID0+IHtcblx0XHRcdFx0XHRwcm9icy5mb3JFYWNoKChfLCBpZHgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IG11ID0gY29udGludW9zQXR0cmlidXRlc1N0YXRzLmdldChhdHRyKVtpZHhdLmdldCgnbXUnKVxuXHRcdFx0XHRcdFx0Y29uc3Qgc2lnbWEgPSBjb250aW51b3NBdHRyaWJ1dGVzU3RhdHMuZ2V0KGF0dHIpW2lkeF0uZ2V0KCdzaWdtYScpXG5cdFx0XHRcdFx0XHRwcm9ic1tpZHhdICo9IGNhbGNHYXVzc2lhbkRlbnNpdHkodmFsdWUsIG11LCBzaWdtYSlcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdHJldHVybiBwcm9ic1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRbMSwgMV0sXG5cdFx0XHQpXG5cdH1cblxuXHRmdW5jdGlvbiBjbGFzc2lmeShvYmplY3QpIHtcblx0XHRjb25zdCBkaXNjcmV0ZUF0dHJzUHJvYnMgPSBnZXREaXNjcmV0ZUF0dHJzUHJvYnMob2JqZWN0KVxuXHRcdGNvbnN0IGNvbnRpbnVvdXNBdHRyc1Byb2JzID0gZ2V0Q29udGludW91c0F0dHJzUHJvYnMob2JqZWN0KVxuXG5cdFx0Y29uc3QgcHJvYnMgPSBbZGlzY3JldGVBdHRyc1Byb2JzLCBjb250aW51b3VzQXR0cnNQcm9ic11cblx0XHRcdC5yZWR1Y2UoKGFjYywgYXR0clByb2IpID0+IHtcblx0XHRcdFx0YWNjWzBdICo9IGF0dHJQcm9iWzBdXG5cdFx0XHRcdGFjY1sxXSAqPSBhdHRyUHJvYlsxXVxuXHRcdFx0XHRyZXR1cm4gYWNjXG5cdFx0XHR9LCBbUDAsIFAxXSlcblxuXHRcdGNvbnN0IHByb2JzU3VtID0gcHJvYnMucmVkdWNlKChhY2MsIHApID0+IGFjYyArIHAsIDApXG5cdFx0cHJvYnMuZm9yRWFjaCgoXywgaWR4KSA9PiB7XG5cdFx0XHRwcm9ic1tpZHhdIC89IHByb2JzU3VtXG5cdFx0fSlcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGVjaXNpb246IHByb2JzWzBdID4gcHJvYnNbMV0gPyAwIDogMSxcblx0XHRcdDA6IHByb2JzWzBdLFxuXHRcdFx0MTogcHJvYnNbMV0sXG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRjbGFzc2lmeSxcblx0fVxufVxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVCYXllc0NsYXNzaWZpZXJcbiIsImNvbnN0IHsgdHJhbnNwb3NlIH0gPSByZXF1aXJlKCcuLi8uLi9hcnJheTJkLXV0aWxzJylcbmNvbnN0IGNyZWF0ZUJheWVzQ2xhc3NpZmllciA9IHJlcXVpcmUoJy4vY3JlYXRlQmF5ZXNDbGFzc2lmaWVyJylcblxuZnVuY3Rpb24gY2FsY0F0dHJpYnV0ZXNGcmVxdWVuY2llcyhhcnJheTJkKSB7XG5cdGNvbnN0IGRlY2lzaW9uc0ZyZXFzID0gYXJyYXkyZC5yZWR1Y2UoXG5cdFx0KGFjYywgcm93KSA9PiB7XG5cdFx0XHRhY2Nbcm93LmF0KC0xKV0rK1xuXHRcdFx0cmV0dXJuIGFjY1xuXHRcdH0sXG5cdFx0WzAsIDBdLFxuXHQpXG5cblx0Y29uc3QgYXR0cmlidXRlc0ZyZXF1ZW5jaWVzID0gdHJhbnNwb3NlKGFycmF5MmQpXG5cdFx0Lm1hcCgoYXR0clJvdywgXywgdHJhbnNwb3NlZEFycikgPT4gdHJhbnNwb3NlKFthdHRyUm93LCB0cmFuc3Bvc2VkQXJyLmF0KC0xKV0pKVxuXHRcdC5zbGljZSgwLCAtMSlcblx0XHQubWFwKGF0dHJSb3dBbmREZWNpc2lvbiA9PiBhdHRyUm93QW5kRGVjaXNpb24ucmVkdWNlKChhdHRyTWFwLCBbYXR0clZhbHVlLCBkZWNpc2lvbl0pID0+IHtcblx0XHRcdGlmICghYXR0ck1hcC5oYXMoYXR0clZhbHVlKSkgYXR0ck1hcC5zZXQoYXR0clZhbHVlLCBbMCwgMF0pXG5cdFx0XHRhdHRyTWFwLmdldChhdHRyVmFsdWUpW2RlY2lzaW9uXSsrXG5cdFx0XHRyZXR1cm4gYXR0ck1hcFxuXHRcdH0sIG5ldyBNYXAoKSkpXG5cblx0cmV0dXJuIHtcblx0XHRhdHRyaWJ1dGVzRnJlcXVlbmNpZXMsXG5cdFx0ZGVjaXNpb25zRnJlcXMsXG5cdH1cbn1cbmZ1bmN0aW9uIGNhbGNBdHRyaWJ1dGVzTXVTaWdtYTIoYXJyYXkyZCkge1xuXHRyZXR1cm4gKFxuXHRcdHRyYW5zcG9zZShhcnJheTJkKVxuXHRcdFx0Lm1hcChhdHRyUm93ID0+IGF0dHJSb3dcblx0XHRcdFx0LnJlZHVjZShcblx0XHRcdFx0XHQoYWNjLCB2YWwsIGlkeCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgZGVjaXNpb24gPSBhcnJheTJkW2lkeF0uYXQoLTEpXG5cdFx0XHRcdFx0XHRhY2NbZGVjaXNpb25dLnB1c2godmFsKVxuXHRcdFx0XHRcdFx0cmV0dXJuIGFjY1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0W1tdLCBbXV0sXG5cdFx0XHRcdClcblx0XHRcdFx0Lm1hcChncm91cGVkQXR0clJvdyA9PiBncm91cGVkQXR0clJvdy5maWx0ZXIodmFsID0+IHZhbCAhPT0gbnVsbCkpXG5cdFx0XHRcdC5tYXAoZ3JvdXBlZEF0dHJSb3cgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG4gPSBncm91cGVkQXR0clJvdy5sZW5ndGhcblx0XHRcdFx0XHRjb25zdCBtdSA9IGdyb3VwZWRBdHRyUm93LnJlZHVjZSgoYWNjLCB2YWwpID0+IGFjYyArIHZhbCwgMCkgLyBuXG5cdFx0XHRcdFx0Y29uc3Qgc2lnbWEgPSAoZ3JvdXBlZEF0dHJSb3cucmVkdWNlKChhY2MsIHZhbCkgPT4gYWNjICsgKHZhbCAtIG11KSAqKiAyLCAwKSAvIChuIC0gMSkpICoqIDAuNVxuXHRcdFx0XHRcdHJldHVybiBuZXcgTWFwKE9iamVjdC5lbnRyaWVzKHsgbXUsIHNpZ21hIH0pKVxuXHRcdFx0XHR9KSlcblx0XHRcdC5zbGljZSgwLCAtMSlcblx0KVxufVxuXG5mdW5jdGlvbiB0cmFpbk5haXZlQmF5ZXNDbGFzc2lmaWVyKFthdHRyTmFtZXMsIC4uLmRhdGFdLCBjb250aW51b3NBdHRyaWJ1dGVzID0gW10pIHtcblx0Y29uc3QgY29udGludW9zQXR0cmlidXRlc0luZGV4ZXMgPSBjb250aW51b3NBdHRyaWJ1dGVzLm1hcCh2YWx1ZSA9PiBhdHRyTmFtZXMuZmluZEluZGV4KHYgPT4gdiA9PT0gdmFsdWUpKVxuXG5cdGNvbnN0IGRpc2NyZXRlQXR0cmlidXRlc0luZGV4ZXMgPSBhdHRyTmFtZXNcblx0XHQuc2xpY2UoMCwgLTEpXG5cdFx0Lm1hcCgoXywgaWR4KSA9PiBpZHgpXG5cdFx0LmZpbHRlcihpZHggPT4gIWNvbnRpbnVvc0F0dHJpYnV0ZXNJbmRleGVzLmluY2x1ZGVzKGlkeCkpXG5cblx0Y29uc3QgZGF0YVRyYW5zcG9zZSA9IHRyYW5zcG9zZShkYXRhKVxuXHRjb25zdCBkZWNpc2lvbkFycmF5ID0gZGF0YVRyYW5zcG9zZS5hdCgtMSlcblxuXHRsZXQgY29udGludW9zQXR0cmlidXRlc1N0YXRzID0gY2FsY0F0dHJpYnV0ZXNNdVNpZ21hMihcblx0XHR0cmFuc3Bvc2UoWy4uLmNvbnRpbnVvc0F0dHJpYnV0ZXNJbmRleGVzLm1hcChpZHggPT4gZGF0YVRyYW5zcG9zZVtpZHhdKSwgZGVjaXNpb25BcnJheV0pLFxuXHQpXG5cblx0Y29udGludW9zQXR0cmlidXRlc1N0YXRzID0gbmV3IE1hcChcblx0XHRjb250aW51b3NBdHRyaWJ1dGVzU3RhdHMubWFwKChhdHRyU3RhdHMsIGlkeCkgPT4gW2F0dHJOYW1lc1tjb250aW51b3NBdHRyaWJ1dGVzSW5kZXhlc1tpZHhdXSwgYXR0clN0YXRzXSksXG5cdClcblxuXHRjb25zdCByZXN1bHQgPSBjYWxjQXR0cmlidXRlc0ZyZXF1ZW5jaWVzKFxuXHRcdHRyYW5zcG9zZShbLi4uZGlzY3JldGVBdHRyaWJ1dGVzSW5kZXhlcy5tYXAoaWR4ID0+IGRhdGFUcmFuc3Bvc2VbaWR4XSksIGRlY2lzaW9uQXJyYXldKSxcblx0KVxuXG5cdGNvbnN0IHsgZGVjaXNpb25zRnJlcXMgfSA9IHJlc3VsdFxuXG5cdGxldCB7IGF0dHJpYnV0ZXNGcmVxdWVuY2llczogZGlzY3JldGVBdHRyaWJ1dGVzRnJlcXMgfSA9IHJlc3VsdFxuXG5cdGRpc2NyZXRlQXR0cmlidXRlc0ZyZXFzXG5cdFx0LmZpbHRlcihhdHRyTWFwID0+ICFhdHRyTWFwLmhhcyhudWxsKSlcblx0XHQuZm9yRWFjaChhdHRyTWFwID0+IHtcblx0XHRcdGF0dHJNYXAuZGVsZXRlKG51bGwpXG5cdFx0fSlcblxuXHRkaXNjcmV0ZUF0dHJpYnV0ZXNGcmVxcyA9IG5ldyBNYXAoXG5cdFx0ZGlzY3JldGVBdHRyaWJ1dGVzRnJlcXMubWFwKChhdHRyUHJvYnMsIGlkeCkgPT4gW2F0dHJOYW1lc1tkaXNjcmV0ZUF0dHJpYnV0ZXNJbmRleGVzW2lkeF1dLCBhdHRyUHJvYnNdKSxcblx0KVxuXG5cdHJldHVybiBjcmVhdGVCYXllc0NsYXNzaWZpZXIoeyBkZWNpc2lvbnNGcmVxcywgZGlzY3JldGVBdHRyaWJ1dGVzRnJlcXMsIGNvbnRpbnVvc0F0dHJpYnV0ZXNTdGF0cyB9KVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRyYWluTmFpdmVCYXllc0NsYXNzaWZpZXJcbiIsImZ1bmN0aW9uIGNhbGNHYXVzc2lhbkRlbnNpdHkoeCwgbXUsIHNpZ21hKSB7XG5cdHJldHVybiBNYXRoLmV4cCgtKCh4IC0gbXUpICoqIDIpIC8gKDIgKiBzaWdtYSAqKiAyKSkgLyAoKCgyICogTWF0aC5QSSkgKiogMC41KSAqIHNpZ21hKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHsgY2FsY0dhdXNzaWFuRGVuc2l0eSB9XG4iLCJjb25zdCB7IGNyZWF0ZU5vZGUsIGNyZWF0ZUxlYWZOb2RlIH0gPSByZXF1aXJlKCcuL2dyYXBoJylcbmNvbnN0IHsgcGFydGl0aW9uMmRBcnJheSwgdHJhbnNwb3NlIH0gPSByZXF1aXJlKCcuLi8uLi9hcnJheTJkLXV0aWxzJylcbmNvbnN0IHsgZ2V0QXR0cmlidXRlVmFsdWVzRnJlcXVlbmNpZXMsIGNhbGNNYXRyaXhJbmZvR2FpbiwgY2FsY0NvbnRpbnVvdXNUaHJlc2hvbGRWYWx1ZSB9ID0gcmVxdWlyZSgnLi91dGlscycpXG5cbmZ1bmN0aW9uIGNhbGNEZWNpc2lvbnNGcmVxdWVuY3koZGF0YSkge1xuXHRyZXR1cm4gZGF0YVxuXHRcdC5tYXAocm93ID0+IHJvdy5hdCgtMSkpXG5cdFx0LnJlZHVjZShcblx0XHRcdChhY2MsIGRlY2lzaW9uKSA9PiB7XG5cdFx0XHRcdGFjY1tkZWNpc2lvbl0rK1xuXHRcdFx0XHRyZXR1cm4gYWNjXG5cdFx0XHR9LFxuXHRcdFx0WzAsIDBdLFxuXHRcdClcbn1cblxuZnVuY3Rpb24gZ2V0SW5kZXhlc09mQ29sdW1uc1dpdGhJZGVudGljYWxWYWx1ZXMoZGF0YSkge1xuXHRyZXR1cm4gdHJhbnNwb3NlKGRhdGEpXG5cdFx0Lm1hcCgocm93LCBpZHgpID0+IFtyb3csIGlkeF0pXG5cdFx0LmZpbHRlcigoW3Jvd10pID0+IG5ldyBTZXQocm93KS5zaXplID09PSAxKVxuXHRcdC5tYXAoKFssIG9yaWdJZHhdKSA9PiBvcmlnSWR4KVxufVxuXG5mdW5jdGlvbiBleGNsdWRlUmVkdW5kYW50QXR0cmlidXRlcyhkYXRhLCBjb2x1bW5OYW1lcykge1xuXHRjb25zdCByZWR1bmRhbnRDb2xJbmRleGVzID0gZ2V0SW5kZXhlc09mQ29sdW1uc1dpdGhJZGVudGljYWxWYWx1ZXMoZGF0YSlcblx0aWYgKCFyZWR1bmRhbnRDb2xJbmRleGVzLmxlbmd0aCkgcmV0dXJuIHsgZGF0YSwgY29sdW1uTmFtZXMgfVxuXG5cdGNvbnN0IGNsZWFuZWREYXRhID0gdHJhbnNwb3NlKHRyYW5zcG9zZShkYXRhKS5maWx0ZXIoKF8sIGlkeCkgPT4gIXJlZHVuZGFudENvbEluZGV4ZXMuaW5jbHVkZXMoaWR4KSkpXG5cdGNvbnN0IGNsZWFuZWRDb2x1bW5OYW1lcyA9IGNvbHVtbk5hbWVzLmZpbHRlcigoXywgaWR4KSA9PiAhcmVkdW5kYW50Q29sSW5kZXhlcy5pbmNsdWRlcyhpZHgpKVxuXG5cdHJldHVybiB7IGRhdGE6IGNsZWFuZWREYXRhLCBjb2x1bW5OYW1lczogY2xlYW5lZENvbHVtbk5hbWVzIH1cbn1cblxuZnVuY3Rpb24gdHJhbnNmb3JtQ29udGludW91c0F0dHJpYnV0ZXNUb0Rpc2NyZXRlKGRhdGEsIGNvbHVtbk5hbWVzLCBjb250aW51b3VzQXR0cmlidXRlcykge1xuXHRjb25zdCBjb250aW51b3NJbmRleGVzID0gY29udGludW91c0F0dHJpYnV0ZXNcblx0XHQubWFwKGNvbnRBdHRyID0+IGNvbHVtbk5hbWVzLmZpbmRJbmRleChjb2xOYW1lID0+IGNvbE5hbWUgPT09IGNvbnRBdHRyKSlcblxuXHRjb25zdCBkYXRhVHJhbnNwb3NlID0gdHJhbnNwb3NlKGRhdGEpXG5cblx0Y29uc3QgdGhyZXNob2xkcyA9IGNvbnRpbnVvc0luZGV4ZXNcblx0XHQubWFwKGNvbnRJZHggPT4ge1xuXHRcdFx0Y29uc3QgeyB0aHJlc2hvbGQgfSA9IGNhbGNDb250aW51b3VzVGhyZXNob2xkVmFsdWUoZGF0YVRyYW5zcG9zZVtjb250SWR4XSwgZGF0YVRyYW5zcG9zZS5hdCgtMSkpXG5cdFx0XHRjb25zdCBhdHRyaWJ1dGVOYW1lID0gY29sdW1uTmFtZXNbY29udElkeF1cblx0XHRcdHJldHVybiB7IGF0dHJpYnV0ZU5hbWUsIHRocmVzaG9sZCB9XG5cdFx0fSlcblx0XHQucmVkdWNlKChhY2MsIHsgdGhyZXNob2xkLCBhdHRyaWJ1dGVOYW1lIH0pID0+IHtcblx0XHRcdGFjYy5zZXQoYXR0cmlidXRlTmFtZSwgdGhyZXNob2xkKVxuXHRcdFx0cmV0dXJuIGFjY1xuXHRcdH0sIG5ldyBNYXAoKSlcblxuXHRjb25zdCBkaXNjcmV0ZURhdGEgPSB0cmFuc3Bvc2UoXG5cdFx0ZGF0YVRyYW5zcG9zZS5tYXAoKGF0dHJWYWx1ZXMsIGlkeCkgPT4ge1xuXHRcdFx0aWYgKCFjb250aW51b3NJbmRleGVzLmluY2x1ZGVzKGlkeCkpIHJldHVybiBhdHRyVmFsdWVzXG5cdFx0XHRjb25zdCBhdHRyTmFtZSA9IGNvbHVtbk5hbWVzW2lkeF1cblx0XHRcdHJldHVybiBhdHRyVmFsdWVzLm1hcCh2YWx1ZSA9PiB2YWx1ZSA8PSB0aHJlc2hvbGRzLmdldChhdHRyTmFtZSkpXG5cdFx0fSksXG5cdClcblxuXHRyZXR1cm4geyB0aHJlc2hvbGRzLCBkaXNjcmV0ZURhdGEgfVxufVxuXG5mdW5jdGlvbiBjb25zdHJ1Y3RJZDNUcmVlKHsgZGF0YSwgY29sdW1uTmFtZXMsIGNvbnRpbnVvdXNBdHRyaWJ1dGVzIH0pIHtcblx0Y29uc3QgZGVjaXNpb25zRnJlcSA9IGNhbGNEZWNpc2lvbnNGcmVxdWVuY3koZGF0YSlcblx0Y29uc3QgbW9zdEZyZXF1ZW50RGVjaXNpb24gPSBkZWNpc2lvbnNGcmVxWzBdID4gZGVjaXNpb25zRnJlcVsxXSA/IDAgOiAxXG5cblx0Y29uc3Qgbm9kZUluZm8gPSB7XG5cdFx0ZGVjaXNpb25zRnJlcXVlbmN5OiBkZWNpc2lvbnNGcmVxLFxuXHRcdG1vc3RGcmVxdWVudERlY2lzaW9uLFxuXHR9XG5cblx0Oyh7IGRhdGEsIGNvbHVtbk5hbWVzIH0gPSBleGNsdWRlUmVkdW5kYW50QXR0cmlidXRlcyhkYXRhLCBjb2x1bW5OYW1lcykpXG5cdGNvbnRpbnVvdXNBdHRyaWJ1dGVzID0gY29udGludW91c0F0dHJpYnV0ZXMuZmlsdGVyKG5hbWUgPT4gY29sdW1uTmFtZXMuaW5jbHVkZXMobmFtZSkpXG5cblx0aWYgKGRlY2lzaW9uc0ZyZXEuc29tZShmcmVxID0+IGZyZXEgPT09IDApIHx8IGRhdGFbMF0ubGVuZ3RoID09PSAxKSB7XG5cdFx0Ly8gYmFzZSBjYXNlczogYWxsIGRlY2lzaW9uIHZhbHVlcyBhcmUgdGhlIHNhbWUsIG9yIHRoZSBkYXRhIGhhcyBubyBhdHRyaWJ1dGVzXG5cdFx0Ly8gcmVtZW1iZXIgJ2V4Y2x1ZGVSZWR1bmRhbnRBdHRyaWJ1dGVzJ1xuXHRcdHJldHVybiBjcmVhdGVMZWFmTm9kZShPYmplY3QuYXNzaWduKG5vZGVJbmZvLCB7IGRlY2lzaW9uOiBtb3N0RnJlcXVlbnREZWNpc2lvbiB9KSlcblx0fVxuXG5cdGNvbnN0IHsgZGlzY3JldGVEYXRhLCB0aHJlc2hvbGRzIH0gPSB0cmFuc2Zvcm1Db250aW51b3VzQXR0cmlidXRlc1RvRGlzY3JldGUoXG5cdFx0ZGF0YSxcblx0XHRjb2x1bW5OYW1lcyxcblx0XHRjb250aW51b3VzQXR0cmlidXRlcyxcblx0KVxuXG5cdGNvbnN0IGF0dHJpYnV0ZXNJbmZvR2FpbiA9IGNhbGNNYXRyaXhJbmZvR2FpbihkaXNjcmV0ZURhdGEpXG5cdGNvbnN0IG1heEluZm9HYWluSWR4ID0gYXR0cmlidXRlc0luZm9HYWluLnJlZHVjZShcblx0XHQoY3VyTWF4SWR4LCBjdXJJbmZvR2FpbiwgaWR4LCBpbmZvR2FpbnMpID0+IChjdXJJbmZvR2FpbiA+IGluZm9HYWluc1tjdXJNYXhJZHhdID8gaWR4IDogY3VyTWF4SWR4KSxcblx0XHQwLFxuXHQpXG5cblx0T2JqZWN0LmFzc2lnbihub2RlSW5mbywge1xuXHRcdGluZm9HYWluOiBhdHRyaWJ1dGVzSW5mb0dhaW5bbWF4SW5mb0dhaW5JZHhdLFxuXHRcdGF0dHJpYnV0ZTogY29sdW1uTmFtZXNbbWF4SW5mb0dhaW5JZHhdLFxuXHR9KVxuXG5cdGlmIChjb250aW51b3VzQXR0cmlidXRlcy5pbmNsdWRlcyhjb2x1bW5OYW1lc1ttYXhJbmZvR2FpbklkeF0pKSB7XG5cdFx0bm9kZUluZm8uaXNDb250aW51b3VzID0gdHJ1ZVxuXHRcdG5vZGVJbmZvLnRocmVzaG9sZCA9IHRocmVzaG9sZHMuZ2V0KGNvbHVtbk5hbWVzW21heEluZm9HYWluSWR4XSlcblx0fSBlbHNlIHtcblx0XHRub2RlSW5mby5pc0NvbnRpbnVvdXMgPSBmYWxzZVxuXHR9XG5cblx0aWYgKGRpc2NyZXRlRGF0YVswXS5sZW5ndGggPT09IDIpIHtcblx0XHQvLyBiYXNlIGNhc2VzOiBvbmx5IDEgYXR0cmlidXRlICgrIGRlY2lzaW9uKVxuXHRcdGNvbnN0IG5vZGUgPSBjcmVhdGVOb2RlKG5vZGVJbmZvKVxuXG5cdFx0Y29uc3QgW2F0dHJWYWx1ZXNNYXBdID0gZ2V0QXR0cmlidXRlVmFsdWVzRnJlcXVlbmNpZXMoZGlzY3JldGVEYXRhKVxuXG5cdFx0YXR0clZhbHVlc01hcC5mb3JFYWNoKChbbiwgcF0sIGF0dHJWYWx1ZSkgPT4ge1xuXHRcdFx0bm9kZS5hZGRBZGphY2VudE5vZGUoXG5cdFx0XHRcdGF0dHJWYWx1ZSxcblx0XHRcdFx0Y3JlYXRlTGVhZk5vZGUoe1xuXHRcdFx0XHRcdGRlY2lzaW9uc0ZyZXF1ZW5jeTogW24sIHBdLFxuXHRcdFx0XHRcdG1vc3RGcmVxdWVudERlY2lzaW9uOiBuID4gcCA/IDAgOiAxLFxuXHRcdFx0XHRcdGRlY2lzaW9uOiBuID4gcCA/IDAgOiAxLFxuXHRcdFx0XHR9KSxcblx0XHRcdClcblx0XHR9KVxuXG5cdFx0cmV0dXJuIG5vZGVcblx0fVxuXG5cdGNvbnN0IGNvbHVtbnNUb1NlbmQgPSBjb2x1bW5OYW1lcy5maWx0ZXIoKF8sIGlkeCkgPT4gaWR4ICE9PSBtYXhJbmZvR2FpbklkeClcblxuXHRsZXQgZGF0YVRvUGFydGl0aW9uXG5cdGlmIChub2RlSW5mby5pc0NvbnRpbnVvdXMpIHtcblx0XHRkYXRhVG9QYXJ0aXRpb24gPSB0cmFuc3Bvc2UoZGF0YSlcblx0XHRkYXRhVG9QYXJ0aXRpb25bbWF4SW5mb0dhaW5JZHhdID0gZGF0YVRvUGFydGl0aW9uW21heEluZm9HYWluSWR4XS5tYXAodmFsdWUgPT4gdmFsdWUgPD0gbm9kZUluZm8udGhyZXNob2xkKVxuXHRcdGRhdGFUb1BhcnRpdGlvbiA9IHRyYW5zcG9zZShkYXRhVG9QYXJ0aXRpb24pXG5cdH0gZWxzZSB7XG5cdFx0ZGF0YVRvUGFydGl0aW9uID0gZGF0YVxuXHR9XG5cblx0Y29uc3Qgbm9kZSA9IGNyZWF0ZU5vZGUobm9kZUluZm8pXG5cblx0cGFydGl0aW9uMmRBcnJheShkYXRhVG9QYXJ0aXRpb24sIG1heEluZm9HYWluSWR4KS5mb3JFYWNoKChwYXJ0aXRpb25lZERhdGEsIGNvbFZhbHVlTmFtZSkgPT4ge1xuXHRcdG5vZGUuYWRkQWRqYWNlbnROb2RlKFxuXHRcdFx0Y29sVmFsdWVOYW1lLFxuXHRcdFx0Y29uc3RydWN0SWQzVHJlZSh7XG5cdFx0XHRcdGRhdGE6IHBhcnRpdGlvbmVkRGF0YSxcblx0XHRcdFx0Y29sdW1uTmFtZXM6IGNvbHVtbnNUb1NlbmQsXG5cdFx0XHRcdGNvbnRpbnVvdXNBdHRyaWJ1dGVzLFxuXHRcdFx0fSksXG5cdFx0KVxuXHR9KVxuXHRyZXR1cm4gbm9kZVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbnN0cnVjdElkM1RyZWVcbiIsImZ1bmN0aW9uIGNyZWF0ZUlkM0NsYXNzaWZpZXIoeyByb290Tm9kZSwgY29udGludW91c0F0dHJpYnV0ZXMgfSkge1xuXHRjb25zdCBub2RlcyA9IGdldEFsbFRyZWVOb2Rlcyhyb290Tm9kZSlcblxuXHRmdW5jdGlvbiBjbGFzc2lmeShvYmplY3QpIHtcblx0XHRsZXQgbm9kZSA9IHJvb3ROb2RlXG5cdFx0Y29uc3QgcGF0aCA9IFtdXG5cdFx0bGV0IGRlY2lzaW9uID0gbnVsbFxuXG5cdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdGNvbnN0IG5vZGVJbmZvID0gbm9kZS5nZXROb2RlSW5mbygpXG5cblx0XHRcdGlmIChub2RlLmlzTGVhZigpKSB7XG5cdFx0XHRcdGRlY2lzaW9uID0gbm9kZUluZm8uZGVjaXNpb25cblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgeyBhdHRyaWJ1dGUgfSA9IG5vZGVJbmZvXG5cdFx0XHRwYXRoLnB1c2goYXR0cmlidXRlKVxuXG5cdFx0XHRpZiAoIShhdHRyaWJ1dGUgaW4gb2JqZWN0KSB8fCBvYmplY3RbYXR0cmlidXRlXSA9PT0gbnVsbCkge1xuXHRcdFx0XHRkZWNpc2lvbiA9IG5vZGVJbmZvLm1vc3RGcmVxdWVudERlY2lzaW9uXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGVkZ2UgPSBub2RlSW5mby5pc0NvbnRpbnVvdXMgPyBvYmplY3RbYXR0cmlidXRlXSA8PSBub2RlSW5mby50aHJlc2hvbGQgOiBvYmplY3RbYXR0cmlidXRlXVxuXG5cdFx0XHRjb25zdCBhZGphY2VudE5vZGVzID0gbm9kZS5nZXRBZGphY2VudE5vZGVzKClcblx0XHRcdGlmICghYWRqYWNlbnROb2Rlcy5oYXMoZWRnZSkpIHtcblx0XHRcdFx0ZGVjaXNpb24gPSBub2RlSW5mby5tb3N0RnJlcXVlbnREZWNpc2lvblxuXHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXG5cdFx0XHRub2RlID0gYWRqYWNlbnROb2Rlcy5nZXQoZWRnZSlcblx0XHR9XG5cblx0XHRyZXR1cm4geyBkZWNpc2lvbiwgcGF0aCB9XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRSb290Tm9kZSgpIHtcblx0XHRyZXR1cm4gT2JqZWN0LmZyZWV6ZSh7IC4uLnJvb3ROb2RlIH0pXG5cdH1cblxuXHRmdW5jdGlvbiBnZXRBbGxUcmVlTm9kZXMocm9vdCkge1xuXHRcdGNvbnN0IG1hcCA9IG5ldyBNYXAoKVxuXG5cdFx0Y29uc3QgcSA9IFtyb290XVxuXG5cdFx0Zm9yIChsZXQgbGVuID0gcS5sZW5ndGg7IGxlbiA+IDA7IGxlbiA9IHEubGVuZ3RoKSB7XG5cdFx0XHR3aGlsZSAobGVuLS0pIHtcblx0XHRcdFx0Y29uc3Qgbm9kZSA9IHEuc2hpZnQoKVxuXHRcdFx0XHRtYXAuc2V0KG5vZGUuZ2V0SWQoKSwgbm9kZSlcblx0XHRcdFx0aWYgKG5vZGUuaXNMZWFmKCkpIGNvbnRpbnVlXG5cdFx0XHRcdG5vZGUuZ2V0QWRqYWNlbnROb2RlcygpLmZvckVhY2goYWRqTm9kZSA9PiBxLnB1c2goYWRqTm9kZSkpXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG1hcFxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0VHJlZU5vZGVzKCkge1xuXHRcdHJldHVybiBub2Rlc1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRjbGFzc2lmeSxcblx0XHRnZXRUcmVlTm9kZXMsXG5cdFx0Z2V0Um9vdE5vZGUsXG5cdH1cbn1cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlSWQzQ2xhc3NpZmllclxuIiwibGV0IGlkeCA9IDBcblxuZnVuY3Rpb24gY3JlYXRlTm9kZShub2RlSW5mbykge1xuXHRjb25zdCBpZCA9IGlkeCsrXG5cblx0Y29uc3QgYWRqYWNlbnROb2RlcyA9IG5ldyBNYXAoKVxuXG5cdGZ1bmN0aW9uIGdldE5vZGVJbmZvKCkge1xuXHRcdHJldHVybiBub2RlSW5mb1xuXHR9XG5cblx0ZnVuY3Rpb24gYWRkQWRqYWNlbnROb2RlKGVkZ2UsIG5vZGUpIHtcblx0XHRhZGphY2VudE5vZGVzLnNldChlZGdlLCBub2RlKVxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0QWRqYWNlbnROb2RlcygpIHtcblx0XHRyZXR1cm4gbmV3IE1hcChhZGphY2VudE5vZGVzKVxuXHR9XG5cblx0ZnVuY3Rpb24gaXNMZWFmKCkge1xuXHRcdHJldHVybiBmYWxzZVxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0SWQoKSB7XG5cdFx0cmV0dXJuIGlkXG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGdldElkLFxuXHRcdGlzTGVhZixcblx0XHRhZGRBZGphY2VudE5vZGUsXG5cdFx0Z2V0QWRqYWNlbnROb2Rlcyxcblx0XHRnZXROb2RlSW5mbyxcblx0fVxufVxuXG5mdW5jdGlvbiBjcmVhdGVMZWFmTm9kZShub2RlSW5mbykge1xuXHRjb25zdCBpZCA9IGlkeCsrXG5cblx0ZnVuY3Rpb24gaXNMZWFmKCkge1xuXHRcdHJldHVybiB0cnVlXG5cdH1cblx0ZnVuY3Rpb24gZ2V0Tm9kZUluZm8oKSB7XG5cdFx0cmV0dXJuIG5vZGVJbmZvXG5cdH1cblxuXHRmdW5jdGlvbiBnZXRJZCgpIHtcblx0XHRyZXR1cm4gaWRcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0Z2V0SWQsXG5cdFx0aXNMZWFmLFxuXHRcdGdldE5vZGVJbmZvLFxuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRjcmVhdGVOb2RlLFxuXHRjcmVhdGVMZWFmTm9kZSxcbn1cbiIsImNvbnN0IHsgdHJhbnNwb3NlIH0gPSByZXF1aXJlKCcuLi8uLi9hcnJheTJkLXV0aWxzJylcbmNvbnN0IHsgZmlsbE1pc3NpbmdWYWx1ZXMgfSA9IHJlcXVpcmUoJy4vdXRpbHMnKVxuY29uc3QgY3JlYXRlQ2xhc3NpZmllciA9IHJlcXVpcmUoJy4vY3JlYXRlSWQzQ2xhc3NpZmllcicpXG5jb25zdCBjb25zdHJ1Y3RJZDNUcmVlID0gcmVxdWlyZSgnLi9jb25zdHJ1Y3RJZDNUcmVlJylcblxuZnVuY3Rpb24gdHJhaW5JZDNDbGFzc2lmaWVyKFtjb2x1bW5OYW1lcywgLi4uZGF0YV0sIGNvbnRpbnVvdXNBdHRyaWJ1dGVzID0gW10pIHtcblx0ZGF0YSA9IHRyYW5zcG9zZShcblx0XHR0cmFuc3Bvc2UoZGF0YSlcblx0XHRcdC5tYXAoKGF0dHJSb3csIGlkeCwgdHJhbnNwb3NlZCkgPT4ge1xuXHRcdFx0XHRpZiAoaWR4ID09PSB0cmFuc3Bvc2VkLmxlbmd0aCAtIDEpIHJldHVybiBhdHRyUm93XG5cdFx0XHRcdHJldHVybiBmaWxsTWlzc2luZ1ZhbHVlcyhhdHRyUm93KVxuXHRcdFx0fSksXG5cdClcblxuXHRjb25zdCByb290Tm9kZSA9IGNvbnN0cnVjdElkM1RyZWUoeyBkYXRhLCBjb2x1bW5OYW1lcywgY29udGludW91c0F0dHJpYnV0ZXMgfSlcblxuXHRyZXR1cm4gY3JlYXRlQ2xhc3NpZmllcih7IHJvb3ROb2RlLCBjb250aW51b3VzQXR0cmlidXRlcyB9KVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRyYWluSWQzQ2xhc3NpZmllclxuIiwiY29uc3QgeyB0cmFuc3Bvc2UgfSA9IHJlcXVpcmUoJy4uLy4uL2FycmF5MmQtdXRpbHMnKVxuXG5mdW5jdGlvbiBmaWxsTWlzc2luZ1ZhbHVlcyhhcnJheSkge1xuXHRjb25zdCBmcmVxTWFwID0gbmV3IE1hcCgpXG5cblx0YXJyYXlcblx0XHQuZmlsdGVyKHZhbHVlID0+IHZhbHVlICE9PSBudWxsKVxuXHRcdC5mb3JFYWNoKHZhbHVlID0+IHtcblx0XHRcdGNvbnN0IHByZUZyZXEgPSBmcmVxTWFwLmhhcyh2YWx1ZSkgPyBmcmVxTWFwLmdldCh2YWx1ZSkgOiAwXG5cdFx0XHRmcmVxTWFwLnNldCh2YWx1ZSwgcHJlRnJlcSArIDEpXG5cdFx0fSlcblxuXHRjb25zdCBmcmVxQXJyYXkgPSBbLi4uZnJlcU1hcC5lbnRyaWVzKCldXG5cblx0Y29uc3QgbnVtTm9uTWlzc2luZ1ZhbHVlcyA9IGZyZXFBcnJheS5yZWR1Y2UoKGFjYywgWywgZnJlcV0pID0+IGFjYyArIGZyZXEsIDApXG5cblx0Y29uc3QgcHJvYkFycmF5ID0gWy4uLmZyZXFBcnJheV1cblx0XHQuc29ydCgoWywgZnJlcTFdLCBbLCBmcmVxMl0pID0+IGZyZXExIC0gZnJlcTIpXG5cdFx0Lm1hcCgoW3ZhbHVlLCBmcmVxXSkgPT4gW3ZhbHVlLCBmcmVxIC8gbnVtTm9uTWlzc2luZ1ZhbHVlc10pXG5cblx0cHJvYkFycmF5LmZvckVhY2goKF8sIGlkeCkgPT4ge1xuXHRcdHByb2JBcnJheVtpZHhdWzFdICs9IGlkeCA9PT0gMCA/IDAgOiBwcm9iQXJyYXlbaWR4IC0gMV1bMV1cblx0fSlcblxuXHRyZXR1cm4gYXJyYXkubWFwKHZhbHVlID0+IHtcblx0XHRpZiAodmFsdWUgIT09IG51bGwpIHJldHVybiB2YWx1ZVxuXHRcdGNvbnN0IHJhbmQgPSBNYXRoLnJhbmRvbSgpXG5cdFx0cmV0dXJuIHByb2JBcnJheS5maW5kKChbLCBwcm9iXSkgPT4gcmFuZCA8PSBwcm9iKVswXVxuXHR9KVxufVxuXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVWYWx1ZXNGcmVxdWVuY2llcyhhcnJheTJkKSB7XG5cdC8qXG5cdFtcblx0XHR7YXR0cjFWMTogW24sIHBdLCBhdHRyMVYyOiBbbiwgcF0sIGF0dHIxVjM6IFtuLCBwXX0sXG5cdFx0e2F0dHIyVjE6IFtuLCBwXSwgYXR0cjJWMjogW24sIHBdLCBhdHRyMlYzOiBbbiwgcF19LFxuXHRcdC4uXG5cdF1cblx0Ki9cblx0cmV0dXJuIHRyYW5zcG9zZShhcnJheTJkKVxuXHRcdC5tYXAoKGF0dHJSb3csIF8sIHRyYW5zcG9zZWRBcnIpID0+IFthdHRyUm93LCB0cmFuc3Bvc2VkQXJyLmF0KC0xKV0pXG5cdFx0Lm1hcCh0cmFuc3Bvc2UpXG5cdFx0Lm1hcChhdHRyRGVjaXNpb24gPT4gYXR0ckRlY2lzaW9uLnJlZHVjZSgobWFwLCBbYXR0clZhbCwgZGVjaXNpb25dKSA9PiB7XG5cdFx0XHRpZiAoIW1hcC5oYXMoYXR0clZhbCkpIG1hcC5zZXQoYXR0clZhbCwgWzAsIDBdKVxuXHRcdFx0bWFwLmdldChhdHRyVmFsKVtkZWNpc2lvbl0rK1xuXHRcdFx0cmV0dXJuIG1hcFxuXHRcdH0sIG5ldyBNYXAoKSkpXG59XG5cbmZ1bmN0aW9uIGNhbGNFbnRyb3B5KG4sIHApIHtcblx0aWYgKHAgPT09IDAgfHwgbiA9PT0gMCkgcmV0dXJuIDBcblx0cmV0dXJuIC0ocCAvIChwICsgbikpICogTWF0aC5sb2cyKHAgLyAocCArIG4pKSAtIChuIC8gKHAgKyBuKSkgKiBNYXRoLmxvZzIobiAvIChwICsgbikpXG59XG5cbmZ1bmN0aW9uIGNhbGNNYXRyaXhJbmZvR2FpbihhcnJheTJkKSB7XG5cdGNvbnN0IG51bVNhbXBsZXMgPSBhcnJheTJkLmxlbmd0aFxuXG5cdGNvbnN0IGF0dHJpYnV0ZVZhbHVlc0ZyZXFzID0gZ2V0QXR0cmlidXRlVmFsdWVzRnJlcXVlbmNpZXMoYXJyYXkyZClcblxuXHRjb25zdCBkYXRhRW50cm9weSA9IGNhbGNFbnRyb3B5KFxuXHRcdGF0dHJpYnV0ZVZhbHVlc0ZyZXFzLmF0KC0xKS5nZXQoMClbMF0sXG5cdFx0YXR0cmlidXRlVmFsdWVzRnJlcXMuYXQoLTEpLmdldCgxKVsxXSxcblx0KVxuXG5cdGNvbnN0IGluZm9FbnRyb3BpZXMgPSBhdHRyaWJ1dGVWYWx1ZXNGcmVxc1xuXHRcdC5zbGljZSgwLCAtMSlcblx0XHQubWFwKGF0dHJNYXAgPT4gKFxuXHRcdFx0Wy4uLmF0dHJNYXAudmFsdWVzKCldLnJlZHVjZSgoYWNjLCBbbiwgcF0pID0+IGFjYyArIChjYWxjRW50cm9weShuLCBwKSAqIChuICsgcCkpIC8gbnVtU2FtcGxlcywgMClcblx0XHQpKVxuXG5cdHJldHVybiBpbmZvRW50cm9waWVzLm1hcChpZSA9PiBkYXRhRW50cm9weSAtIGllKVxufVxuZnVuY3Rpb24gY2FsY0NvbnRpbnVvdXNUaHJlc2hvbGRWYWx1ZSh2YWx1ZXNBcnJheSwgZGVjaXNpb25zKSB7XG5cdGNvbnN0IHNvcnRlZFVuaXF1ZVZhbHVlcyA9IFsuLi5uZXcgU2V0KHZhbHVlc0FycmF5KV0uc29ydCgoYSwgYikgPT4gYSAtIGIpXG5cblx0Y29uc29sZS5hc3NlcnQoc29ydGVkVW5pcXVlVmFsdWVzLmxlbmd0aCA+PSAyKVxuXG5cdHJldHVybiBzb3J0ZWRVbmlxdWVWYWx1ZXNcblx0XHQucmVkdWNlKChiZXN0LCBfLCBpZHgpID0+IHtcblx0XHRcdGlmIChpZHggPT09IDApIHJldHVybiBudWxsXG5cblx0XHRcdGNvbnN0IHRocmVzaG9sZCA9IChzb3J0ZWRVbmlxdWVWYWx1ZXNbaWR4XSArIHNvcnRlZFVuaXF1ZVZhbHVlc1tpZHggLSAxXSkgLyAyXG5cdFx0XHRjb25zdCBbaW5mb0dhaW5dID0gY2FsY01hdHJpeEluZm9HYWluKHRyYW5zcG9zZShbdmFsdWVzQXJyYXkubWFwKHZhbHVlID0+IHZhbHVlIDw9IHRocmVzaG9sZCksIGRlY2lzaW9uc10pKVxuXG5cdFx0XHRpZiAoYmVzdCA9PT0gbnVsbCB8fCBpbmZvR2FpbiA+IGJlc3QuaW5mb0dhaW4pIHJldHVybiB7IHRocmVzaG9sZCwgaW5mb0dhaW4gfVxuXG5cdFx0XHRyZXR1cm4gYmVzdFxuXHRcdH0sIG51bGwpXG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRjYWxjQ29udGludW91c1RocmVzaG9sZFZhbHVlLFxuXHRjYWxjRW50cm9weSxcblx0Y2FsY01hdHJpeEluZm9HYWluLFxuXHRmaWxsTWlzc2luZ1ZhbHVlcyxcblx0Z2V0QXR0cmlidXRlVmFsdWVzRnJlcXVlbmNpZXMsXG59XG4iLCJmdW5jdGlvbiBwYXJ0aXRpb24yZEFycmF5KGFycmF5MmQsIGNvbHVtbklkeCkge1xuXHRjb25zdCBudW1Db2x1bW5zID0gYXJyYXkyZFswXS5sZW5ndGhcblx0Y29sdW1uSWR4ID0gKChjb2x1bW5JZHggJSBudW1Db2x1bW5zKSArIG51bUNvbHVtbnMpICUgbnVtQ29sdW1uc1xuXG5cdHJldHVybiBhcnJheTJkLnJlZHVjZSgocGFydHMsIHJvdykgPT4ge1xuXHRcdGNvbnN0IHRhcmdldENvbHVtblZhbHVlID0gcm93W2NvbHVtbklkeF1cblxuXHRcdGlmICghcGFydHMuaGFzKHRhcmdldENvbHVtblZhbHVlKSkgcGFydHMuc2V0KHRhcmdldENvbHVtblZhbHVlLCBbXSlcblxuXHRcdHBhcnRzLmdldCh0YXJnZXRDb2x1bW5WYWx1ZSkucHVzaChbLi4ucm93LnNsaWNlKDAsIGNvbHVtbklkeCksIC4uLnJvdy5zbGljZShjb2x1bW5JZHggKyAxKV0pXG5cblx0XHRyZXR1cm4gcGFydHNcblx0fSwgbmV3IE1hcCgpKVxufVxuXG5mdW5jdGlvbiB0cmFuc3Bvc2UoYXJyYXkpIHtcblx0Y29uc3Qgcm93cyA9IGFycmF5Lmxlbmd0aFxuXG5cdGlmIChyb3dzID09PSAwKSByZXR1cm4gW11cblxuXHRjb25zdCBjb2xzID0gYXJyYXlbMF0ubGVuZ3RoXG5cblx0aWYgKGNvbHMgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHRyYW5zcG9zZShbYXJyYXldKVxuXG5cdGNvbnN0IHJldCA9IG5ldyBBcnJheShjb2xzKS5maWxsKG51bGwpLm1hcCgoKSA9PiBuZXcgQXJyYXkocm93cykuZmlsbChudWxsKSlcblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IHJvd3M7IGkrKykge1xuXHRcdGZvciAobGV0IGogPSAwOyBqIDwgY29sczsgaisrKSB7XG5cdFx0XHRyZXRbal1baV0gPSBhcnJheVtpXVtqXVxuXHRcdH1cblx0fVxuXG5cdHJldHVybiByZXRcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdHBhcnRpdGlvbjJkQXJyYXksXG5cdHRyYW5zcG9zZSxcbn1cbiIsImZ1bmN0aW9uIG1vdmVEZWNpc2lvbkF0dHJpYnV0ZVRvTGFzdENvbHVtbihkYXRhLCBhdHRyaWJ1dGVzLCBkZWNpc2lvbkF0dHJpYnV0ZSkge1xuXHRjb25zdCBqID0gYXR0cmlidXRlcy5maW5kSW5kZXgoYXR0ciA9PiBhdHRyID09PSBkZWNpc2lvbkF0dHJpYnV0ZSlcblxuXHRjb25zdCBuID0gYXR0cmlidXRlcy5sZW5ndGhcblxuXHRpZiAoaiA9PT0gbiAtIDEpIHJldHVybiB7IGRhdGEsIGF0dHJpYnV0ZXMgfVxuXG5cdGRhdGEgPSBbLi4uZGF0YV1cblx0YXR0cmlidXRlcyA9IFsuLi5kYXRhXVxuXG5cdDtbZGF0YVtqXSwgZGF0YVtuIC0gMV1dID0gW2RhdGFbbiAtIDFdLCBkYXRhW2pdXVxuXHQ7W2F0dHJpYnV0ZXNbal0sIGF0dHJpYnV0ZXNbbiAtIDFdXSA9IFthdHRyaWJ1dGVzW24gLSAxXSwgYXR0cmlidXRlc1tqXV1cblxuXHRyZXR1cm4geyBkYXRhLCBhdHRyaWJ1dGVzIH1cbn1cblxuZnVuY3Rpb24gcmVwbGFjZU1pc3NpbmdEYXRhKGRhdGEsIG1pc3NpbmdEYXRhVmFsdWVzKSB7XG5cdHJldHVybiBkYXRhLm1hcChyb3cgPT4gcm93Lm1hcCh2YWx1ZSA9PiAobWlzc2luZ0RhdGFWYWx1ZXMuaW5jbHVkZXModmFsdWUpID8gbnVsbCA6IHZhbHVlKSkpXG59XG5cbmZ1bmN0aW9uIGNhc3RDb2x1bW5zVG9OdW1iZXIoZGF0YSwgY29sdW1uSW5kZXhlcykge1xuXHRyZXR1cm4gZGF0YS5tYXAocm93ID0+IHtcblx0XHRyb3cgPSBbLi4ucm93XVxuXHRcdGNvbHVtbkluZGV4ZXMuZm9yRWFjaChjb2xJZHggPT4ge1xuXHRcdFx0cm93W2NvbElkeF0gPSBOdW1iZXIocm93W2NvbElkeF0pXG5cdFx0fSlcblx0XHRyZXR1cm4gcm93XG5cdH0pXG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VEZWNpc2lvbkF0dHJpYnV0ZXNXaXRoMChkYXRhLCBwb3NpdGl2ZVZhbHVlcykge1xuXHRyZXR1cm4gZGF0YS5tYXAocm93ID0+IHtcblx0XHRyb3cgPSBbLi4ucm93XVxuXHRcdGNvbnN0IHZhbHVlID0gcm93W3Jvdy5sZW5ndGggLSAxXVxuXHRcdHJvd1tyb3cubGVuZ3RoIC0gMV0gPSB2YWx1ZSA9PT0gcG9zaXRpdmVWYWx1ZXMgPyAxIDogMFxuXHRcdHJldHVybiByb3dcblx0fSlcbn1cblxuZnVuY3Rpb24gcHJlcGFyZURhdGEoe1xuXHRkYXRhOiBvcmlnRGF0YSxcblx0ZGVjaXNpb25BdHRyaWJ1dGUsXG5cdG1pc3NpbmdEYXRhVmFsdWVzLFxuXHRjb250aW51b3NBdHRyaWJ1dGVzLFxuXHRwb3NpdGl2ZURlY2lzaW9uVmFsdWUsXG5cdHJlbmFtZURlY2lzaW9uVG8gPSBudWxsLFxufSkge1xuXHRsZXQgYXR0cmlidXRlcyA9IG9yaWdEYXRhWzBdXG5cdGxldCBkYXRhID0gb3JpZ0RhdGEuc2xpY2UoMSlcblxuXHQ7KHsgZGF0YSwgYXR0cmlidXRlcyB9ID0gbW92ZURlY2lzaW9uQXR0cmlidXRlVG9MYXN0Q29sdW1uKGRhdGEsIGF0dHJpYnV0ZXMsIGRlY2lzaW9uQXR0cmlidXRlKSlcblx0ZGF0YSA9IHJlcGxhY2VNaXNzaW5nRGF0YShkYXRhLCBtaXNzaW5nRGF0YVZhbHVlcylcblxuXHRjb25zdCBjb250aW51b3NBdHRyaWJ1dGVzSW5kZXhlcyA9IGNvbnRpbnVvc0F0dHJpYnV0ZXMubWFwKGF0dHIgPT4gYXR0cmlidXRlcy5maW5kSW5kZXgodiA9PiB2ID09PSBhdHRyKSlcblx0ZGF0YSA9IGNhc3RDb2x1bW5zVG9OdW1iZXIoZGF0YSwgY29udGludW9zQXR0cmlidXRlc0luZGV4ZXMpXG5cblx0ZGF0YSA9IHJlcGxhY2VEZWNpc2lvbkF0dHJpYnV0ZXNXaXRoMChkYXRhLCBwb3NpdGl2ZURlY2lzaW9uVmFsdWUpXG5cblx0aWYgKHJlbmFtZURlY2lzaW9uVG8pIGF0dHJpYnV0ZXNbYXR0cmlidXRlcy5sZW5ndGggLSAxXSA9IHJlbmFtZURlY2lzaW9uVG9cblxuXHRyZXR1cm4geyBkYXRhLCBhdHRyaWJ1dGVzIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBwcmVwYXJlRGF0YVxuIiwibW9kdWxlLmV4cG9ydHMgPSBbW1wiYWdlXCIsXCJjaGVzdF9wYWluX3R5cGVcIixcInJlc3RfYmxvb2RfcHJlc3N1cmVcIixcImJsb29kX3N1Z2FyXCIsXCJyZXN0X2VsZWN0cm9cIixcIm1heF9oZWFydF9yYXRlXCIsXCJleGVyY2ljZV9hbmdpbmFcIixcImRpc2Vhc2VcIl0sW1wiNDNcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzVcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzlcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2MFwiLFwieWVzXCIsXCJuZWdhdGl2ZVwiXSxbXCIzOVwiLFwibm9uX2FuZ2luYWxcIixcIjE2MFwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCIxNjBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0MlwiLFwibm9uX2FuZ2luYWxcIixcIjE2MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQ2XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDlcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MFwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzNVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU5XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiVFJVRVwiLFwibGVmdF92ZW50X2h5cGVyXCIsXCIxMTlcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTRcIixcImFzeW1wdFwiLFwiMjAwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDJcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTlcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjVcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NlwiLFwiYXN5bXB0XCIsXCIxNzBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjEyMlwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1MlwiLFwibm9uX2FuZ2luYWxcIixcIjE0MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTcwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNjBcIixcImFzeW1wdFwiLFwiMTAwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjVcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NVwiLFwiYXR5cF9hbmdpbmFcIixcIjE2MFwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCIxNDNcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTdcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzhcIixcImFzeW1wdFwiLFwiMTEwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjZcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI2MFwiLFwibm9uX2FuZ2luYWxcIixcIjEyMFwiLFwiRkFMU0VcIixcImxlZnRfdmVudF9oeXBlclwiLFwiMTM1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTVcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUwXCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTQwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQ4XCIsXCJhc3ltcHRcIixcIjEwNlwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCIxMTBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCIzOVwiLFwiYXR5cF9hbmdpbmFcIixcIjE5MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTA2XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNjZcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCI5NFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NlwiLFwiYXN5bXB0XCIsXCIxNTVcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQ0XCIsXCJhc3ltcHRcIixcIjEzNVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTM1XCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNDNcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTRcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMThcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTJcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzOFwiLFwieWVzXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OFwiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExNVwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjUxXCIsXCJub25fYW5naW5hbFwiLFwiMTM1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1OVwiLFwibm9uX2FuZ2luYWxcIixcIjE4MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTAwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNThcIixcImF0eXBfYW5naW5hXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ2XCIsXCJhc3ltcHRcIixcIjExOFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTI0XCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTRcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCI5MVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0OFwiLFwiYXN5bXB0XCIsXCIxNjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjkyXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM4XCIsXCJhc3ltcHRcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM5XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NlwiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExNVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzM1wiLFwibm9uX2FuZ2luYWxcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTg1XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTBcIixcImFzeW1wdFwiLFwiMTQ1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI0MVwiLFwiYXR5cF9hbmdpbmFcIixcIjEyNVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQ0XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDlcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNjVcIixcImFzeW1wdFwiLFwiMTcwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjExMlwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1MFwiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTcwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNjVcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjg3XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQ2XCIsXCJ0eXBfYW5naW5hXCIsXCIxNDBcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTc1XCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNDBcIixcIm5vbl9hbmdpbmFsXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE4OFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjM5XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NFwiLFwiYXN5bXB0XCIsXCIxMjVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQ4XCIsXCJub25fYW5naW5hbFwiLFwiMTEwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzhcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NVwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzMFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0NFwiLFwiYXR5cF9hbmdpbmFcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU2XCIsXCJub25fYW5naW5hbFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTRcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzMlwiLFwiYXR5cF9hbmdpbmFcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTg0XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTVcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTM3XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTRcIixcIm5vbl9hbmdpbmFsXCIsXCIxNTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyMlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUxXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTI1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0N1wiLFwiYXR5cF9hbmdpbmFcIixcIjE2MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTc0XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTdcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE0NVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0M1wiLFwiYXR5cF9hbmdpbmFcIixcIjE0MlwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTM4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDVcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTIyXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTNcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2MlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ2XCIsXCJub25fYW5naW5hbFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NlwiLFwibm9uX2FuZ2luYWxcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTI4XCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjQ4XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMThcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NVwiLFwidHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwiP1wiLFwiMTM2XCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNDlcIixcIm5vbl9hbmdpbmFsXCIsXCIxMTVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3NVwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjU2XCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTI0XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM5XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxNDZcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MlwiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjUzXCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQ4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTVcIixcIm5vbl9hbmdpbmFsXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJsZWZ0X3ZlbnRfaHlwZXJcIixcIjEzNFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ2XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTEyXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiMzZcIixcIm5vbl9hbmdpbmFsXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3OFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUzXCIsXCJub25fYW5naW5hbFwiLFwiMTQ1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCIzNFwiLFwiYXR5cF9hbmdpbmFcIixcIjk4XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzMVwiLFwiYXN5bXB0XCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1M1wiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIyOVwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTYwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDZcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2NVwiLFwieWVzXCIsXCJuZWdhdGl2ZVwiXSxbXCIyOVwiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTcwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDNcIixcImFzeW1wdFwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDlcIixcImFzeW1wdFwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjJcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCIzOVwiLFwiYXN5bXB0XCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjM4XCIsXCJhc3ltcHRcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTcwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTRcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1NFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQwXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzMlwiLFwiYXN5bXB0XCIsXCIxMThcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzMFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjU1XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTEwXCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjQyXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OFwiLFwiYXN5bXB0XCIsXCIxNjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEwM1wiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0NVwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0NFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUzXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzOVwiLFwiYXN5bXB0XCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzMlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQxXCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTMwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNDJcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ5XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTAwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzRcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1NFwiLFwiYXR5cF9hbmdpbmFcIixcIjE2MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTMwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNThcIixcIm5vbl9hbmdpbmFsXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjI4XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibGVmdF92ZW50X2h5cGVyXCIsXCIxODVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NlwiLFwiYXN5bXB0XCIsXCIxMTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1MVwiLFwiYXR5cF9hbmdpbmFcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDhcIixcImFzeW1wdFwiLFwiMTYwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMDJcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTFcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0MlwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ4XCIsXCJhc3ltcHRcIixcIjE2MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiOTlcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzJcIixcImF0eXBfYW5naW5hXCIsXCIxMjVcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1NVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU1XCIsXCJub25fYW5naW5hbFwiLFwiMTEwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1M1wiLFwiYXN5bXB0XCIsXCIxMjRcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjExMlwiLFwieWVzXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NlwiLFwiYXN5bXB0XCIsXCIxODBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjEyMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU1XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQ1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NlwiLFwiYXN5bXB0XCIsXCIxMTBcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjE0MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ5XCIsXCJhc3ltcHRcIixcIjEyOFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiOTZcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzVcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJsZWZ0X3ZlbnRfaHlwZXJcIixcIjE4MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjM1XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTEwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDBcIixcIm5vXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NFwiLFwibm9uX2FuZ2luYWxcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTM3XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNThcIixcImF0eXBfYW5naW5hXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ5XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTIwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjUyXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTYwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjVcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0OFwiLFwiYXN5bXB0XCIsXCIxMjJcIixcIlRSVUVcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTUwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjYyXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0MVwiLFwiYXN5bXB0XCIsXCIxMTJcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUyXCIsXCJhc3ltcHRcIixcIjE2MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiODJcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDBcIixcIm5vbl9hbmdpbmFsXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzOFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUyXCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTIwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM5XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzRcIixcInR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTgwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNDBcIixcIm5vbl9hbmdpbmFsXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE2N1wiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ3XCIsXCJhc3ltcHRcIixcIjE2MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTU4XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQ3XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiVFJVRVwiLFwibm9ybWFsXCIsXCIxMjVcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiNTZcIixcImFzeW1wdFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0MFwiLFwiYXR5cF9hbmdpbmFcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTcyXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTJcIixcImFzeW1wdFwiLFwiMTYwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCI5NFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NFwiLFwiYXR5cF9hbmdpbmFcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQyXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTRcIixcImF0eXBfYW5naW5hXCIsXCIxNjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3NVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUzXCIsXCJhc3ltcHRcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTE2XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjUwXCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTIxXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU1XCIsXCJhc3ltcHRcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDdcIixcImFzeW1wdFwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCI5OFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzNlwiLFwibm9uX2FuZ2luYWxcIixcIjExMlwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTg0XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNjVcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMTVcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzdcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMzBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTRcIixcInR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTM3XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzZcIixcIm5vbl9hbmdpbmFsXCIsXCIxNTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ3XCIsXCJub25fYW5naW5hbFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDVcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiMzZcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE4MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUyXCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTM0XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQxXCIsXCJhc3ltcHRcIixcIjExMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTcwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNDJcIixcIm5vbl9hbmdpbmFsXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MlwiLFwieWVzXCIsXCJuZWdhdGl2ZVwiXSxbXCIzN1wiLFwiYXR5cF9hbmdpbmFcIixcIjEzMFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiOThcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1OFwiLFwibm9uX2FuZ2luYWxcIixcIjEzMFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTQwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNTBcIixcImFzeW1wdFwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDBcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiNDhcIixcImF0eXBfYW5naW5hXCIsXCIxMDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEwMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU4XCIsXCJhc3ltcHRcIixcIjEzNVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTAwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNThcIixcImF0eXBfYW5naW5hXCIsXCIxMzZcIixcIkZBTFNFXCIsXCJzdF90X3dhdmVfYWJub3JtYWxpdHlcIixcIjk5XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQ0XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNDJcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzOFwiLFwibm9uX2FuZ2luYWxcIixcIjE0NVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTMwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTRcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExMFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ2XCIsXCJhc3ltcHRcIixcIjExMFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTQwXCIsXCJ5ZXNcIixcIm5lZ2F0aXZlXCJdLFtcIjU0XCIsXCJub25fYW5naW5hbFwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTZcIixcImFzeW1wdFwiLFwiMTUwXCIsXCJUUlVFXCIsXCJub3JtYWxcIixcIjEyNVwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1M1wiLFwibm9uX2FuZ2luYWxcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNjFcIixcImFzeW1wdFwiLFwiMTI1XCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMTVcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiNDlcIixcIm5vbl9hbmdpbmFsXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUwXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTcwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMTZcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0NVwiLFwibm9uX2FuZ2luYWxcIixcIjEzNVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTEwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTJcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjRcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTBcIixcImFzeW1wdFwiLFwiMTQwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMjVcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDNcIixcInR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTU1XCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiMzhcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUzXCIsXCJhc3ltcHRcIixcIjE4MFwiLFwiRkFMU0VcIixcInN0X3Rfd2F2ZV9hYm5vcm1hbGl0eVwiLFwiMTIwXCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjU3XCIsXCJhc3ltcHRcIixcIjE1MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiOTJcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTlcIixcImF0eXBfYW5naW5hXCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE1MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjU0XCIsXCJhc3ltcHRcIixcIjEyNVwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTIyXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiMzlcIixcIm5vbl9hbmdpbmFsXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjUwXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MlwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTE4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDRcIixcImFzeW1wdFwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNzBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCIzNlwiLFwiYXR5cF9hbmdpbmFcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTYwXCIsXCJub1wiLFwicG9zaXRpdmVcIl0sW1wiNDRcIixcImF0eXBfYW5naW5hXCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzNVwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQ2XCIsXCJhc3ltcHRcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTI1XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQxXCIsXCJhc3ltcHRcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTE4XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjQ1XCIsXCJhc3ltcHRcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTQwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDVcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMzBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTJcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMTBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNTVcIixcImFzeW1wdFwiLFwiMTQ1XCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCI5NlwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCIzN1wiLFwibm9uX2FuZ2luYWxcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTUwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDFcIixcImF0eXBfYW5naW5hXCIsXCIxMjBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjM3XCIsXCJhc3ltcHRcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTU4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNDRcIixcImFzeW1wdFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMDBcIixcInllc1wiLFwicG9zaXRpdmVcIl0sW1wiNDJcIixcImF0eXBfYW5naW5hXCIsXCIxNTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzNlwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjQxXCIsXCJhdHlwX2FuZ2luYVwiLFwiMTIwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxNjBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1OVwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwibm9cIixcIm5lZ2F0aXZlXCJdLFtcIjM0XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTUwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxNjhcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1MlwiLFwiYXN5bXB0XCIsXCIxNzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEyNlwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NlwiLFwiYXR5cF9hbmdpbmFcIixcIjEzMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTAwXCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiMzhcIixcImFzeW1wdFwiLFwiOTJcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEzNFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NFwiLFwiYXN5bXB0XCIsXCIxNDBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjEwNVwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjQ4XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1OFwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE0MFwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI1NFwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIlRSVUVcIixcIm5vcm1hbFwiLFwiMTI1XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM1XCIsXCJhdHlwX2FuZ2luYVwiLFwiMTUwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNjhcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI1OFwiLFwibm9uX2FuZ2luYWxcIixcIjE2MFwiLFwiVFJVRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCI5MlwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjU1XCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTI4XCIsXCJ5ZXNcIixcInBvc2l0aXZlXCJdLFtcIjM3XCIsXCJhc3ltcHRcIixcIjEyMFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTY4XCIsXCJub1wiLFwibmVnYXRpdmVcIl0sW1wiNTRcIixcImFzeW1wdFwiLFwiMTUwXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCIxMzRcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI0N1wiLFwidHlwX2FuZ2luYVwiLFwiMTEwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxNTBcIixcIm5vXCIsXCJuZWdhdGl2ZVwiXSxbXCI2M1wiLFwiYXN5bXB0XCIsXCIxNTBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjExNVwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjU5XCIsXCJub25fYW5naW5hbFwiLFwiMTMwXCIsXCJGQUxTRVwiLFwibm9ybWFsXCIsXCIxMjBcIixcInllc1wiLFwibmVnYXRpdmVcIl0sW1wiNTJcIixcImFzeW1wdFwiLFwiMTEyXCIsXCJGQUxTRVwiLFwic3RfdF93YXZlX2Fibm9ybWFsaXR5XCIsXCI5NlwiLFwieWVzXCIsXCJwb3NpdGl2ZVwiXSxbXCI0OVwiLFwiYXN5bXB0XCIsXCIxMzBcIixcIkZBTFNFXCIsXCJub3JtYWxcIixcIjE3MFwiLFwibm9cIixcInBvc2l0aXZlXCJdLFtcIjUzXCIsXCJhc3ltcHRcIixcIjE0MFwiLFwiRkFMU0VcIixcIm5vcm1hbFwiLFwiMTU1XCIsXCJub1wiLFwibmVnYXRpdmVcIl1dIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGdldERlZmF1bHRFeHBvcnQgZnVuY3Rpb24gZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBub24taGFybW9ueSBtb2R1bGVzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLm4gPSAobW9kdWxlKSA9PiB7XG5cdHZhciBnZXR0ZXIgPSBtb2R1bGUgJiYgbW9kdWxlLl9fZXNNb2R1bGUgP1xuXHRcdCgpID0+IChtb2R1bGVbJ2RlZmF1bHQnXSkgOlxuXHRcdCgpID0+IChtb2R1bGUpO1xuXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmQoZ2V0dGVyLCB7IGE6IGdldHRlciB9KTtcblx0cmV0dXJuIGdldHRlcjtcbn07IiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsImltcG9ydCBjcmVhdGVJZDNDbGFzc2lmaWVyIGZyb20gJy4uL2RhdGEtbWluaW5nL2FsZ29yaXRobXMvaWQzJ1xuaW1wb3J0IHByZXBhcmVEYXRhIGZyb20gJy4uL2RhdGEtbWluaW5nL3ByZXBhcmVEYXRhJ1xuaW1wb3J0IGNyZWF0ZUJheWVzQ2xhc3NpZmllciBmcm9tICcuLi9kYXRhLW1pbmluZy9hbGdvcml0aG1zL2JheWVzJ1xuaW1wb3J0IGRhdGFzZXQgZnJvbSAnLi4vZGF0YS1taW5pbmcvaGVhcnRfZGlzZWFzZV9tYWxlLmNzdidcblxuY29uc3QgY29udGludW9zQXR0cmlidXRlcyA9IFsnYWdlJywgJ3Jlc3RfYmxvb2RfcHJlc3N1cmUnLCAnbWF4X2hlYXJ0X3JhdGUnXVxuXG5jb25zdCB7IGRhdGE6IHRyYWluRGF0YSwgYXR0cmlidXRlcyB9ID0gcHJlcGFyZURhdGEoe1xuXHRkYXRhOiBkYXRhc2V0LFxuXHRjb250aW51b3NBdHRyaWJ1dGVzLFxuXHRkZWNpc2lvbkF0dHJpYnV0ZTogJ2Rpc2Vhc2UnLFxuXHRtaXNzaW5nRGF0YVZhbHVlczogWyc/JywgJyddLFxuXHRwb3NpdGl2ZURlY2lzaW9uVmFsdWU6ICdwb3NpdGl2ZScsXG5cdHJlbmFtZURlY2lzaW9uVG86ICdkZWNpc2lvbicsXG59KVxuXG50cmFpbkRhdGEudW5zaGlmdChhdHRyaWJ1dGVzLnNsaWNlKCkpXG5cbmNvbnN0IGlkM0NsYXNzaWZpZXIgPSBjcmVhdGVJZDNDbGFzc2lmaWVyKHRyYWluRGF0YSwgY29udGludW9zQXR0cmlidXRlcylcbmNvbnN0IGJheWVzQ2xhc3NpZmllciA9IGNyZWF0ZUJheWVzQ2xhc3NpZmllcih0cmFpbkRhdGEsIGNvbnRpbnVvc0F0dHJpYnV0ZXMpXG5cbmNvbnN0IGZvcm0gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdmb3JtJylcbmNvbnN0IHJlc3VsdEVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnJlc3VsdCcpXG5jb25zdCByZXN1bHRJY29uID0gcmVzdWx0RWwucXVlcnlTZWxlY3RvcignLnJlc3VsdC1pY29uJylcblxucmVzdWx0SWNvbi5hZGRFdmVudExpc3RlbmVyKCdhbmltYXRpb25lbmQnLCAoKSA9PiB7XG5cdHJlc3VsdEljb24uY2xhc3NMaXN0LnJlbW92ZSgnYW5pbWF0ZScpXG59KVxuXG5mb3JtLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4ge1xuXHRyZXN1bHRFbC5jbGFzc0xpc3QucmVtb3ZlKCdzaG93Jylcblx0cmVzdWx0SWNvbi5jbGFzc0xpc3QucmVtb3ZlKCdhbmltYXRlJylcbn0pXG5cbmZvcm0uYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgZSA9PiB7XG5cdGUucHJldmVudERlZmF1bHQoKVxuXHRjb25zdCBlbnRyaWVzID0gWy4uLm5ldyBGb3JtRGF0YShmb3JtKV1cblx0XHQuZmlsdGVyKChbLCB2YWx1ZV0pID0+IHZhbHVlICE9PSAnJylcblx0XHQubWFwKChbYXR0ciwgdmFsdWVdKSA9PiB7XG5cdFx0XHRpZiAoIWNvbnRpbnVvc0F0dHJpYnV0ZXMuaW5jbHVkZXMoYXR0cikpIHJldHVybiBbYXR0ciwgdmFsdWVdXG5cdFx0XHRyZXR1cm4gW2F0dHIsIE51bWJlcih2YWx1ZSldXG5cdFx0fSlcblx0Y29uc3QgZGF0YU9iamVjdCA9IE9iamVjdC5mcm9tRW50cmllcyhlbnRyaWVzKVxuXHRjb25zb2xlLmxvZyhkYXRhT2JqZWN0KVxuXG5cdGxldCByZXN1bHRcblxuXHRpZiAoZGF0YU9iamVjdC5hbGdvcml0aG0gPT09ICdpZDMnKSB7XG5cdFx0cmVzdWx0ID0gaWQzQ2xhc3NpZmllci5jbGFzc2lmeShkYXRhT2JqZWN0KVxuXHR9IGVsc2Uge1xuXHRcdHJlc3VsdCA9IGJheWVzQ2xhc3NpZmllci5jbGFzc2lmeShkYXRhT2JqZWN0KVxuXHR9XG5cblx0Y29uc29sZS5sb2cocmVzdWx0KVxuXHRjb25zdCB7IGRlY2lzaW9uIH0gPSByZXN1bHRcblx0cmVzdWx0RWwuY2xhc3NMaXN0LnJlbW92ZSgncG9zaXRpdmUnLCAnbmVnYXRpdmUnKVxuXHRyZXN1bHRFbC5jbGFzc0xpc3QuYWRkKCdzaG93JywgWyduZWdhdGl2ZScsICdwb3NpdGl2ZSddW2RlY2lzaW9uXSlcblx0cmVzdWx0SWNvbi5jbGFzc0xpc3QuYWRkKCdhbmltYXRlJylcbn0pXG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=