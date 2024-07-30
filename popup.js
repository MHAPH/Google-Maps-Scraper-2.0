document.addEventListener('DOMContentLoaded', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var currentTab = tabs[0];
        var actionButton = document.getElementById('actionButton');
        var downloadCsvButton = document.getElementById('downloadCsvButton');
        var resultsTable = document.getElementById('resultsTable');
        var filenameInput = document.getElementById('filenameInput');
        var loadingText = document.createElement('div');
        
        loadingText.id = 'loadingText';
        loadingText.style.display = 'none';
        loadingText.style.marginTop = '10px';
        loadingText.textContent = 'Wait till your data is being scraped!';
        document.body.appendChild(loadingText);

        if (currentTab && currentTab.url.includes("://www.google.com/maps/search")) {
            document.getElementById('message').textContent = "Let's scrape Google Maps!";
            actionButton.disabled = false;
            actionButton.classList.add('enabled');
        } else {
            var messageElement = document.getElementById('message');
            messageElement.innerHTML = '';
            var linkElement = document.createElement('a');
            linkElement.href = 'https://www.google.com/maps/search/';
            linkElement.textContent = "Go to Google Maps Search.";
            linkElement.target = '_blank'; 
            messageElement.appendChild(linkElement);

            actionButton.style.display = 'none'; 
            downloadCsvButton.style.display = 'none';
            filenameInput.style.display = 'none'; 
        }

        actionButton.addEventListener('click', function() {
            // Show loading text when scraping starts
            loadingText.style.display = 'block';

            chrome.scripting.executeScript({
                target: {tabId: currentTab.id},
                function: scrapeData
            }, function(results) {
                while (resultsTable.firstChild) {
                    resultsTable.removeChild(resultsTable.firstChild);
                }

                // Define and add headers to the table
                const headers = ['Title', 'Rating', 'Reviews', 'Phone', 'Industry', 'Address', 'Website', 'Google Maps Link'];
                const headerRow = document.createElement('tr');
                headers.forEach(headerText => {
                    const header = document.createElement('th');
                    header.textContent = headerText;
                    headerRow.appendChild(header);
                });
                resultsTable.appendChild(headerRow);

                // Add new results to the table
                if (!results || !results[0] || !results[0].result) return;
                results[0].result.forEach(function(item) {
                    var row = document.createElement('tr');
                    ['title', 'rating', 'reviewCount', 'phone', 'industry', 'address', 'companyUrl', 'href'].forEach(function(key) {
                        var cell = document.createElement('td');
                        
                        if (key === 'reviewCount' && item[key]) {
                            item[key] = item[key].replace(/\(|\)/g, ''); 
                        }
                        
                        cell.textContent = item[key] || ''; 
                        row.appendChild(cell);
                    });
                    resultsTable.appendChild(row);
                });

                if (results && results[0] && results[0].result && results[0].result.length > 0) {
                    downloadCsvButton.disabled = false;
                }

                // Hide loading text when scraping finishes
                loadingText.style.display = 'none';
            });
        });

        downloadCsvButton.addEventListener('click', function() {
            var csv = tableToCsv(resultsTable); 
            var filename = filenameInput.value.trim();
            if (!filename) {
                filename = 'google-maps-data.csv'; 
            } else {
                filename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.csv';
            }
            downloadCsv(csv, filename); 
        });

    });
});

async function scrapeData() {
    const delay = ms => new Promise(res => setTimeout(res, ms));

    var links = Array.from(document.querySelectorAll('a[href^="https://www.google.com/maps/place"]'));
    var results = [];

    for (let link of links) {
        link.click();
        await delay(5000 + Math.random() * 3000); // Increased delay between clicks to 5-8 seconds

        var container = document.querySelector('.bJzME.Hu9e2e.tTVLSc');
        if (container) {
            var titleText = '';
            var rating = '';
            var reviewCount = '';
            var phone = '';
            var industry = '';
            var address = '';
            var companyUrl = '';

            // Title
            var titleElement = container.querySelector('h1.DUwDvf.lfPIob');
            titleText = titleElement ? titleElement.textContent.trim() : '';

            // Rating
            var roleImgContainer = container.querySelector('[role="img"]');
            if (roleImgContainer) {
                var ariaLabel = roleImgContainer.getAttribute('aria-label');
                if (ariaLabel && ariaLabel.includes("stars")) {
                    var parts = ariaLabel.split(' ');
                    rating = parts[0];
                } else {
                    rating = '0';
                }
            }

            // Review Count
            var reviewCountElement = container.querySelector('[aria-label*="reviews"]');
            reviewCount = reviewCountElement ? reviewCountElement.textContent.trim() : '0';

            // Address
            var addressElement = container.querySelector('.rogA2c .Io6YTe');
            address = addressElement ? addressElement.textContent.trim() : '';
            if (address.startsWith('Address: ')) {
                address = address.replace('Address: ', '');
            }

            // URL
            var urlElement = container.querySelector('a[data-item-id="authority"]');
            if (urlElement) {
                var fullUrl = urlElement.getAttribute('href') || '';
                var url = new URL(fullUrl);
                companyUrl = url.origin; // This will get the base URL
            } else {
                companyUrl = '';
            }

            // Phone Number
            var phoneElement = container.querySelector('.CsEnBe[aria-label^="Phone"]');
            var phone = '';
            if (phoneElement) {
                phone = phoneElement.getAttribute('aria-label').replace('Phone: ', '').trim();
            }


            // Industry
            var industryElement = container.querySelector('.fontBodyMedium .DkEaL');
            industry = industryElement ? industryElement.textContent.trim() : '';

            results.push({
                title: titleText,
                rating: rating,
                reviewCount: reviewCount,
                phone: phone,
                industry: industry,
                address: address,
                companyUrl: companyUrl,
                href: link.href,
            });
        }
    }
    return results;
}


// Convert the table to a CSV string
function tableToCsv(table) {
    var csv = [];
    var rows = table.querySelectorAll('tr');
    
    for (var i = 0; i < rows.length; i++) {
        var row = [], cols = rows[i].querySelectorAll('td, th');
        
        for (var j = 0; j < cols.length; j++) {
            row.push('"' + cols[j].innerText + '"');
        }
        csv.push(row.join(','));
    }
    return csv.join('\n');
}

// Download the CSV file
function downloadCsv(csv, filename) {
    var csvFile;
    var downloadLink;

    csvFile = new Blob([csv], {type: 'text/csv'});
    downloadLink = document.createElement('a');
    downloadLink.download = filename;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
}
