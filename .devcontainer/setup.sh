#!/bin/bash

cd frontend
npm install @angular/cli
npm install
npm run generate:all

cd ../backend
export PYTHON=""
julia +1.7 --project -e 'using Pkg; Pkg.instantiate()'
julia +1.7 --project setup.jl
