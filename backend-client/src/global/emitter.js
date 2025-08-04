import mitt from "mitt";
const emitter = mitt();
const registeredEvents = {};

export default emitter;
