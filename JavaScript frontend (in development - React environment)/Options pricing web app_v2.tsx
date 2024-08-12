"use client";

import { useState, useEffect } from "react";
import dynamic from 'next/dynamic';
import { erf } from 'mathjs';

// Dynamically import Plot with SSR disabled
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

// Function to generate heatmap data
const generateHeatmapData = (
  model: string,
  inputs: {
    S: number;
    T: number;
    r: number;
    sigma: number;
    q: number;
    N: number;
  },
  strikePrices: number[],
  volatilities: number[]
) => {
  const callData: number[][] = [];
  const putData: number[][] = [];

  for (let i = 0; i < volatilities.length; i++) {
    const callRow: number[] = [];
    const putRow: number[] = [];

    for (let j = 0; j < strikePrices.length; j++) {
      if (model === "Black-Scholes") {
        const { callPrice, putPrice } = blackScholes(
          inputs.S,
          strikePrices[j],
          inputs.T,
          inputs.r,
          Math.max(volatilities[i], 0),  // Ensure volatility is at least 0
          inputs.q
        );
        callRow.push(Math.max(callPrice, 0));  // Ensure option price is at least 0
        putRow.push(Math.max(putPrice, 0));    // Ensure option price is at least 0
      } else if (model === "Binomial Tree") {
        const callPrice = binomialTree(
          inputs.S,
          strikePrices[j],
          inputs.T,
          inputs.r,
          Math.max(volatilities[i], 0),  // Ensure volatility is at least 0
          inputs.q,
          inputs.N,
          "call"
        );
        const putPrice = binomialTree(
          inputs.S,
          strikePrices[j],
          inputs.T,
          inputs.r,
          Math.max(volatilities[i], 0),  // Ensure volatility is at least 0
          inputs.q,
          inputs.N,
          "put"
        );
        callRow.push(Math.max(callPrice, 0));  // Ensure option price is at least 0
        putRow.push(Math.max(putPrice, 0));    // Ensure option price is at least 0
      }
    }

    callData.push(callRow);
    putData.push(putRow);
  }

  return { callData, putData };
};

// Black-Scholes Model Function
const blackScholes = (
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  q: number
): { callPrice: number; putPrice: number } => {
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const callPrice = S * Math.exp(-q * T) * normalCdf(d1) - K * Math.exp(-r * T) * normalCdf(d2);
  const putPrice = K * Math.exp(-r * T) * normalCdf(-d2) - S * Math.exp(-q * T) * normalCdf(-d1);

  return { callPrice, putPrice };
};

// Binomial Tree Model Function
const binomialTree = (
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  q: number,
  N: number,
  optionType: string
): number => {
  const dt = T / N;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const p = (Math.exp((r - q) * dt) - d) / (u - d);

  let prices: number[] = [];
  for (let i = 0; i <= N; i++) {
    prices[i] = S * Math.pow(u, N - i) * Math.pow(d, i);
  }

  let optionPrices: number[] = prices.map((price) =>
    optionType === "call" ? Math.max(0, price - K) : Math.max(0, K - price)
  );

  for (let j = N - 1; j >= 0; j--) {
    for (let i = 0; i <= j; i++) {
      optionPrices[i] = Math.exp(-r * dt) * (p * optionPrices[i] + (1 - p) * optionPrices[i + 1]);
    }
  }

  return optionPrices[0];
};

// Normal CDF for Black-Scholes
function normalCdf(x: number): number {
  return (1.0 + erf(x / Math.sqrt(2.0))) / 2.0;
}

export default function Home() {
  const [model, setModel] = useState("Black-Scholes");
  const [inputs, setInputs] = useState<{
    S: number;
    K_min: number;
    K_max: number;
    K_specific: number;
    T: number;
    r: number;
    sigma: number;
    q: number;
    N: number;
  }>({
    S: 100.42,
    K_min: 80.0,
    K_max: 120.0,
    K_specific: 93.45,
    T: 1.0,
    r: 0.05,
    sigma: 0.2,
    q: 0.0,
    N: 100,
  });

  const [results, setResults] = useState<{ callPrice?: number; putPrice?: number }>({});
  const [heatmapData, setHeatmapData] = useState<{ callData: number[][]; putData: number[][] }>({
    callData: [],
    putData: [],
  });

  useEffect(() => {
    // Calculate option prices based on selected model
    if (model === "Black-Scholes") {
      const { callPrice, putPrice } = blackScholes(
        inputs.S, inputs.K_specific, inputs.T, inputs.r, Math.max(inputs.sigma, 0), inputs.q
      );
      setResults({ callPrice: Math.max(callPrice, 0), putPrice: Math.max(putPrice, 0) });
    } else if (model === "Binomial Tree") {
      const callPrice = binomialTree(
        inputs.S, inputs.K_specific, inputs.T, inputs.r, Math.max(inputs.sigma, 0), inputs.q, inputs.N, "call"
      );
      const putPrice = binomialTree(
        inputs.S, inputs.K_specific, inputs.T, inputs.r, Math.max(inputs.sigma, 0), inputs.q, inputs.N, "put"
      );
      setResults({ callPrice: Math.max(callPrice, 0), putPrice: Math.max(putPrice, 0) });
    }

    // Generate heatmap data
    const strikePrices = Array.from({ length: 10 }, (_, i) => (inputs.K_min + i * (inputs.K_max - inputs.K_min) / 9).toFixed(2));
    const volatilities = Array.from({ length: 10 }, (_, i) => Math.max(((inputs.sigma - 0.1) + i * 0.02), 0).toFixed(2)).reverse();

    const { callData, putData } = generateHeatmapData(model, inputs, strikePrices.map(Number), volatilities.map(Number));
    setHeatmapData({ callData, putData });
  }, [model, inputs]);

  const inputLabels = {
    S: "Asset Price",
    K_min: "Minimum Strike Price",
    K_max: "Maximum Strike Price",
    K_specific: "Specific Strike Price",
    T: "Time to Maturity",
    r: "Interest Rate",
    sigma: "Implied Volatility",
    q: "Dividend Yield",
    N: "Number of Steps"
  };

  const formatHeatmapData = (data: number[][]) => {
    const min = Math.min(...data.flat());
    const max = Math.max(...data.flat());

    return data.map(row =>
      row.map(value => ({
        value,
        text: value.toFixed(2),
        color: (value - min) / (max - min) > 0.5 ? 'white' : 'black'
      }))
    );
  };

  return (
    <main className="flex flex-col lg:flex-row min-h-screen p-8 bg-gray-100">
      {/* Left Side: Inputs */}
      <div className="w-full lg:w-1/5 p-4 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Select Model</h2>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full p-2 mb-4 border border-gray-300 rounded-lg"
        >
          <option value="Black-Scholes">Black-Scholes</option>
          <option value="Binomial Tree">Binomial Tree</option>
        </select>

        <h3 className="text-lg font-semibold mb-2">Input Parameters</h3>
        {Object.entries(inputs).map(([key, value]) => (
          <div key={key} className="mb-4">
            <label className="block text-gray-700 mb-1 text-sm">
              {inputLabels[key as keyof typeof inputs]}
            </label>
            <input
              type="number"
              name={key}
              value={value}
              onChange={(e) =>
                setInputs((prev) => ({
                  ...prev,
                  [key]: parseFloat(e.target.value),
                }))
              }
              step={key === "N" ? "1" : "0.01"}
              disabled={model === "Black-Scholes" && key === "N"} // Disable input for N when Black-Scholes is selected
              className={`w-full p-2 border border-gray-300 rounded-lg text-sm ${
                model === "Black-Scholes" && key === "N" ? "bg-gray-200 cursor-not-allowed" : ""
              }`}
            />
          </div>
        ))}
      </div>

      {/* Right Side: Outputs */}
      <div className="w-full lg:w-4/5 pl-0 lg:pl-8 flex flex-col">
        <h2 className="text-2xl font-bold mb-4">{model} Option Pricing Heatmaps</h2>

        {/* Welcome message box */}
        <div className="p-4 bg-blue-100 text-blue-800 rounded-lg shadow-md mb-4">
          <p className="font-bold">
            Welcome! Explore how option prices move across different volatility levels and strike prices. 
            Black-Scholes and Binomial Tree models are currently available with Finite Differences and Heston’s 
            Stochastic Volatility models coming soon.
          </p>
        </div>

        {/* Call and Put Value Boxes */}
        <div className="flex flex-col lg:flex-row justify-between mb-8">
          <div className="flex flex-col items-center bg-green-100 text-green-800 p-4 rounded-lg shadow-md w-full lg:w-1/2 mb-4 lg:mb-0 lg:mr-4">
            <h3 className="text-lg font-semibold">Theoretical Call Value</h3>
            <p className="text-3xl font-bold">
              {results.callPrice !== undefined ? `$${results.callPrice.toFixed(2)}` : "Calculating..."}
            </p>
          </div>
          <div className="flex flex-col items-center bg-red-100 text-red-800 p-4 rounded-lg shadow-md w-full lg:w-1/2 lg:ml-4">
            <h3 className="text-lg font-semibold">Theoretical Put Value</h3>
            <p className="text-3xl font-bold">
              {results.putPrice !== undefined ? `$${results.putPrice.toFixed(2)}` : "Calculating..."}
            </p>
          </div>
        </div>

        {/* Heatmaps Section */}
        <div className="flex flex-col lg:flex-row gap-8 flex-wrap">
          <div className="flex-1 bg-white p-4 rounded-lg shadow-md w-full lg:max-w-full lg:max-h-full relative flex flex-col lg:flex-row overflow-x-auto">
            <div className="flex flex-col items-center w-full">
              <h3 className="text-lg font-semibold mb-2 text-center">CALL</h3>
              <Plot
                data={[
                  {
                    z: heatmapData.callData,
                    x: Array.from({ length: 10 }, (_, i) => (inputs.K_min + i * (inputs.K_max - inputs.K_min) / 9).toFixed(2)),
                    y: Array.from({ length: 10 }, (_, i) => Math.max(((inputs.sigma - 0.1) + i * 0.02), 0).toFixed(2)).reverse(),
                    type: "heatmap",
                    colorscale: "Viridis",
                    text: formatHeatmapData(heatmapData.callData).map(row => row.map(cell => cell.text)),
                    hoverinfo: "x+y+z",
                    zmin: Math.max(Math.min(...heatmapData.callData.flat()), 0),
                    zmax: Math.max(...heatmapData.callData.flat()),
                    texttemplate: "%{text}",
                    showscale: true,
                    colorbar: {
                      titleside: "right",
                      thickness: 25,
                    },
                  },
                ]}
                layout={{
                  xaxis: {
                    title: "Strike Price",
                  },
                  yaxis: {
                    title: "Volatility",
                  },
                  margin: {
                    l: 50,
                    r: 50,
                    t: 0,
                    b: 50,
                  },
                }}
                useResizeHandler
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </div>
          <div className="flex-1 bg-white p-4 rounded-lg shadow-md w-full lg:max-w-full lg:max-h-full relative flex flex-col lg:flex-row overflow-x-auto">
            <div className="flex flex-col items-center w-full">
              <h3 className="text-lg font-semibold mb-2 text-center">PUT</h3>
              <Plot
                data={[
                  {
                    z: heatmapData.putData,
                    x: Array.from({ length: 10 }, (_, i) => (inputs.K_min + i * (inputs.K_max - inputs.K_min) / 9).toFixed(2)),
                    y: Array.from({ length: 10 }, (_, i) => Math.max(((inputs.sigma - 0.1) + i * 0.02), 0).toFixed(2)).reverse(),
                    type: "heatmap",
                    colorscale: "Viridis",
                    text: formatHeatmapData(heatmapData.putData).map(row => row.map(cell => cell.text)),
                    hoverinfo: "x+y+z",
                    zmin: Math.max(Math.min(...heatmapData.putData.flat()), 0),
                    zmax: Math.max(...heatmapData.putData.flat()),
                    texttemplate: "%{text}",
                    showscale: true,
                    colorbar: {
                      titleside: "right",
                      thickness: 25,
                    },
                  },
                ]}
                layout={{
                  xaxis: {
                    title: "Strike Price",
                  },
                  yaxis: {
                    title: "Volatility",
                  },
                  margin: {
                    l: 50,
                    r: 50,
                    t: 0,
                    b: 50,
                  },
                }}
                useResizeHandler
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Inline CSS */}
      <style jsx>{`
        .flex-1 {
          flex: 1;
          min-width: 0;
        }
        .max-w-full {
          max-width: 100%;
        }
        .max-h-full {
          max-height: 100%;
        }
        .flex-grow {
          flex-grow: 1;
        }
        .text-right {
          text-align: right;
        }
        .cursor-not-allowed {
          cursor: not-allowed;
        }
        @media (max-width: 1024px) {
          .lg\:pl-8 {
            padding-left: 0;
          }
          .w-full, .w-4/5, .w-1/5 {
            width: 100%;
          }
          .p-4, .mb-4 {
            padding: 0.5rem;
            margin-bottom: 1rem;
          }
        }
        .transform {
          transform: rotate(-90deg);
        }
        .origin-left {
          transform-origin: left center.
        }
        .overflow-x-auto {
          overflow-x: auto;
        }
      `}</style>
    </main>
  );
}
