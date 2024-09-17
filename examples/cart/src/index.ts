import("./bootstrap").then(module => {
  const applicationInit = module.default;

  const container = document.getElementById("root");

  if (container) {
    applicationInit(container)
  }
});
