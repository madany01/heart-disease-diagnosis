const { transpose } = require('../../array2d-utils')
const createBayesClassifier = require('./createBayesClassifier')

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
		.filter(attrMap => attrMap.has(null))
		.forEach(attrMap => {
			attrMap.delete(null)
		})

	discreteAttributesFreqs = new Map(
		discreteAttributesFreqs.map((attrProbs, idx) => [attrNames[discreteAttributesIndexes[idx]], attrProbs]),
	)

	return createBayesClassifier({ decisionsFreqs, discreteAttributesFreqs, continuosAttributesStats })
}

module.exports = trainNaiveBayesClassifier
