/**
 *
 * @param {*} rawConn
 * @param {*} isListener
 */
declare function create(rawConn: any, isListener: any): void;

/**
 * @module internals
 */
declare module "internals" {
    class Channel {
        /**
         * Conditionally emit errors if we have listeners. All other
         * events are sent to EventEmitter.emit
         * @param {string} eventName
         * @param  {...any} args
         * @returns {void}
         */
        emit(eventName: string, ...args: any[]): void;
    }
    class Multiplex {
    }
}

/**
 * @module internals
 */
declare module "internals" {
    class Channel {
        /**
         * Conditionally emit errors if we have listeners. All other
         * events are sent to EventEmitter.emit
         * @param {string} eventName
         * @param  {...any} args
         * @returns {void}
         */
        emit(eventName: string, ...args: any[]): void;
    }
    class Multiplex {
    }
}

/**
 *
 * @param {object} conn
 * @param {*} multiplex
 */
declare class MultiplexMuxer {
    constructor(conn: any, multiplex: any);
    /**
     * Conditionally emit errors if we have listeners. All other
     * events are sent to EventEmitter.emit
     *
     * @param {string} eventName
     * @param  {...any} args
     * @returns {void}
     */
    emit(eventName: string, ...args: any[]): void;
    /**
     * enable pure stream
     *
     * @param {function} callback
     */
    newStream(callback: (...params: any[]) => any): void;
    /**
     * Destroys multiplex and ends all internal streams
     *
     * @param {Error} err Optional error to pass to end the muxer with
     * @param {function()} callback Optional
     * @returns {void}
     */
    end(err: Error, callback: (...params: any[]) => any): void;
}

