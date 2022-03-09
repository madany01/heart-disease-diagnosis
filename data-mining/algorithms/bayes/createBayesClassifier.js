const { calcGaussianDensity } = require('./utils')

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
