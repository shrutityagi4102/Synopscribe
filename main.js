chrome.storage.sync.get(null, settings => {
    const node = document.createElement('probe')
    document.body.appendChild(node)
    const view = new View(node)
    const escrape = new Escrape()
    escrape.injectCssEntries()

    if (settings.show_icon.value) {
        const summary = extractPageSummary(settings, escrape)
        view.update(summary)
    }

    chrome.runtime.onMessage.addListener((data, _, callback) => {
        if (data == 'getElementContent') {
            const summary = extractPageSummary(settings, escrape)
            callback(summary)
            view.update(summary)
        }
        return true
    })
})


function extractPageSummary(settings, escrape) {
    const stopUrls = ['', '/', '/search', '/search/'] // TODO: Settings.

    if (settings.suppress_landing.value && stopUrls.includes(document.location.pathname.toLowerCase()))
        return {
            success: false,
            message: 'probe is configured to ignore landing pages and search pages, as they are generally bad candidates for summarization. You may change this in the extension Options.',
        }

    escrape.reset()
    escrape.ignoreAll(
        escrape.selectAbstractElements(),
        escrape.selectAsideElements(),
        escrape.selectHyperlinkContainers(),
        escrape.selectVisualContainers()
    )

    const node = escrape.findArticleContainer()
    if (node) {
        let text = ''
        for (const t of escrape.getTextList(node))
            text += t + '\n'

        const content = new probeSentencesDocumentProcessor(text, settings.summary_size.value / 20)
        if (text.length >= 250 && content.documents.length >= 12) {
            const topSentences = content.getTopKDocuments()
            return {
                success: true,
                title: escrape.getPageTitle(),
                description: escrape.getPageDescription(),
                topSentences: topSentences,
                topTopics: content.getTopKTopics(),
                originalWordCount: content.documents.reduce((a, b) => a + b.words.length, 0),
                summaryWordCount: topSentences.reduce((a, b) => a + b.words.length, 0),
            }
        }
    }
    return {
        success: false,
        message: 'This page is not a good candidate for summarization. Try longer pages such as news articles, blog posts, or encyclopdia entries.',
    }
}