import {copyFile} from 'fs';

const filename = 'refresh-runtime.js';

// destination will be created or overwritten by default.
copyFile(`./node_modules/@vitejs/plugin-react/dist/${filename}`, `./src/${filename}`, (err) => {
    if (err) throw err;
    console.log(`${filename} was copied`);
});
