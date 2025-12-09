import React, { Component } from "react";

class Counter extends Component {
  constructor(props) {
    super(props);
    // initial state
    this.state = {
      count: 0
    };
  }

  // method to increment count
  increment = () => {
    this.setState({ count: this.state.count + 1 });
  };

  // method to decrement count
  decrement = () => {
    this.setState({ count: this.state.count - 1 });
  };

  // method to reset count
  reset = () => {
    this.setState({ count: 0 });
  };

  render() {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h1>Counter: {this.state.count}</h1>
        <button onClick={this.increment}>Increment</button>
        <button onClick={this.decrement} style={{ margin: "0 10px" }}>
          Decrement
        </button>
        <button onClick={this.reset}>Reset</button>
      </div>
    );
  }
}

export default Counter;
