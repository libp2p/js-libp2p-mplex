## Old node stream based interop tests

### What is this?

This will install libp2p-mplex version `0.7.0` and run tests against it using the new `pull-mplex` implementation. This needs to be a separate packages because we can't install `libp2p-mplex` into `libp2p-mplex` ;(

### To run the tests do:

```
npm i && npm run test
```