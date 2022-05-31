
import {ResourcesManager} from 'mhlib';

import {IndexedDBBase} from '../basic/IndexedDBBase';

export class IndexedDBResourcesManager extends ResourcesManager {

    constructor() {
        super();

        this.db = new IndexedDBBase('res');

    }

    async storeResource(base64data) {

        const base64hash = await ResourcesManager.generateKeyForData(base64data);

        await this.db.put(base64hash, base64data);

        return base64hash;
    }

    async getResource(base64hash) {

        const base64data = await this.db.get(base64hash);

        return base64data;

    }

};
