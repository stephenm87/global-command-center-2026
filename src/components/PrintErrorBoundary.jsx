import React from 'react';

export default class PrintErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch() {
        this.props.onError?.();
    }

    render() {
        if (this.state.hasError) return null;
        return this.props.children;
    }
}
