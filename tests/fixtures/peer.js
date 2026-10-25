/* Deterministic test transport. Exercises the app protocol; not WebRTC validation. */
class Events {
  constructor() {
    this.events = new Map();
  }
  on(name, fn) {
    this.events.set(name, [...(this.events.get(name) || []), fn]);
    return this;
  }
  emit(name, ...args) {
    for (const fn of this.events.get(name) || []) fn(...args);
  }
}
class TestConnection extends Events {
  constructor(owner, remote, id) {
    super();
    this.owner = owner;
    this.peer = remote;
    this.id = id;
    this.open = false;
  }
  send(data) {
    if (this.open)
      this.owner.channel.postMessage({
        kind: "data",
        from: this.owner.id,
        to: this.peer,
        id: this.id,
        data,
      });
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.owner.channel.postMessage({
      kind: "close",
      from: this.owner.id,
      to: this.peer,
      id: this.id,
    });
    this.emit("close");
  }
}
window.Peer = class extends Events {
  constructor(id) {
    super();
    this.id = id;
    this.destroyed = false;
    this.open = false;
    this.connections = new Map();
    this.channel = new BroadcastChannel("twoplay-test");
    this.channel.onmessage = ({ data: m }) => {
      if (m.to !== this.id) return;
      let c = this.connections.get(m.id);
      if (m.kind === "connect") {
        c = new TestConnection(this, m.from, m.id);
        this.connections.set(m.id, c);
        this.emit("connection", c);
        this.channel.postMessage({
          kind: "accept",
          from: this.id,
          to: m.from,
          id: m.id,
        });
        c.open = true;
        c.emit("open");
      } else if (c) {
        if (m.kind === "accept") {
          c.open = true;
          c.emit("open");
        } else if (m.kind === "data") c.emit("data", m.data);
        else if (m.kind === "close") {
          c.open = false;
          c.emit("close");
        }
      }
    };
    setTimeout(() => {
      if (!this.destroyed) {
        this.open = true;
        this.emit("open", id);
      }
    }, 0);
  }
  connect(id) {
    const c = new TestConnection(this, id, crypto.randomUUID());
    this.connections.set(c.id, c);
    this.channel.postMessage({
      kind: "connect",
      from: this.id,
      to: id,
      id: c.id,
    });
    return c;
  }
  reconnect() {
    this.open = true;
    this.emit("open", this.id);
  }
  destroy() {
    this.destroyed = true;
    this.open = false;
    for (const c of this.connections.values()) c.close();
    this.channel.close();
    this.emit("close");
  }
};
