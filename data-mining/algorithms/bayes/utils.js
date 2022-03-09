function calcGaussianDensity(x, mu, sigma) {
	return Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2)) / (((2 * Math.PI) ** 0.5) * sigma)
}

module.exports = { calcGaussianDensity }
