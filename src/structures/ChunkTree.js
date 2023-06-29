/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import { Chunk } from '../chunking/Chunk.js';
import { LocalHost } from '../env/LocalHost.js';
import { TreeBranch } from './TreeBranch.js';
import { TreeContainer } from './TreeContainer.js';
 
export class ChunkTree {

	constructor(degree=5, root, owner) {
		this.degree = degree;
		this.rootChunk = root;
        if(owner
        && owner !== LocalHost.getID()) {
            this.owner = owner;
        } else {
            this.local = true;
        }
	}

    async delete(key) {
		if(key instanceof Chunk === false) {
            throw Error('key is not a valid Chunk');
        }
        if(!this.local) {
            throw Error('Attempt to edit a remote chunk tree');
        }
		if(this.rootChunk == null
		|| this.rootChunk == undefined) {
            throw Error('tree is empty');
		} else {
            const branch = new TreeBranch(this.rootChunk.id, this.owner);
            await branch.getToKey(key.id);
            if(branch.containsKey === false) {
                throw Error('key does not exist in tree');
            }
            // console.log('tree.remove('+key+')');
            const ownerContainer = branch.getLastContainer();
            // console.log('original ownerContainer: ' + JSON.stringify(ownerContainer, null, 2));
            const minElements = Math.floor(this.degree/2);
            var mergeDepth;
            if(ownerContainer.isLeaf()) {
                ownerContainer.remove(key.id);
                // console.log('ownerContainer after key '+key+' was removed: ' + JSON.stringify(ownerContainer, null, 2));
                if(ownerContainer.numElements < minElements
                && branch.depth > 0) {
                    mergeDepth = await branch.rebalance(minElements);
                }
            } else {
                const [leftContainerKey, rightContainerKey] = ownerContainer.getChildrenAroundKey(key.id);
                const leftBranch = new TreeBranch(leftContainerKey, this.owner);
                await leftBranch.getToRightmostLeaf();
                const leftStealLeaf = leftBranch.getLastContainer();
                const rightBranch = new TreeBranch(rightContainerKey, this.owner);
                await rightBranch.getToLeftmostLeaf();
                const rightStealLeaf = rightBranch.getLastContainer();
                var stolenElement;
                if(leftStealLeaf.numElements >= rightStealLeaf.numElements) {
                    const [poppedKey, poppedSiblingKey] = await leftStealLeaf.pop();
                    stolenElement = poppedKey;
                    branch.append(leftBranch);
                } else {
                    const [shiftedKey, shiftedSiblingKey] = await rightStealLeaf.shift();
                    stolenElement = shiftedKey;
                    branch.append(rightBranch);
                }
                ownerContainer.substituteElement(key.id, stolenElement);
                const branchLeaf = branch.getLastContainer();
                if(branchLeaf.numElements < minElements) {
                    mergeDepth = await branch.rebalance(minElements);
                }
            }
            const newRootKey = await branch.update(mergeDepth);
            this.rootChunk = Chunk.fromIdentifier(newRootKey, this.owner);
        }
    }

	async has(key) {
        if(key instanceof Chunk === false) {
            throw Error('key is not a valid chunk');
        }
		if(this.rootChunk) {
			var iContainer = await TreeContainer.fromDescriptor(this.rootChunk);
			while(iContainer) {
				const nextContainerIdentifier = iContainer.follow(key.id);
				if(nextContainerIdentifier === true) {
					return true;
				}
                const containerDescriptor = Chunk.fromIdentifier(nextContainerIdentifier, this.rootChunk.ownerID);
                iContainer = await TreeContainer.fromDescriptor(containerDescriptor);
			}
		}
        return false;
	}

	async isEmpty() {
		if(this.rootChunk
        && this.rootChunk.id) {
            const rootContainer = await this.rootChunk.expand(0, true);
			if(rootContainer.numElements > 0) {
				return false;
			}
		}
		return true;
	}

};
