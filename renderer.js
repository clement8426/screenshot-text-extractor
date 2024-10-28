const { ipcRenderer } = require('electron');

document.getElementById('start-capture').addEventListener('click', () => {
    ipcRenderer.send('start-screen-capture');
});

ipcRenderer.on('new-entry', (event, { text, image }) => {
    const historyList = document.getElementById('text-history');
    const newItem = document.createElement('li');
    newItem.classList.add('history-item');

    const imgElement = document.createElement('img');
    imgElement.src = image;
    imgElement.classList.add('capture-image');

    const textElement = document.createElement('p');
    textElement.textContent = text;
    textElement.classList.add('capture-text');

    newItem.appendChild(imgElement);
    newItem.appendChild(textElement);
    historyList.appendChild(newItem);
});
