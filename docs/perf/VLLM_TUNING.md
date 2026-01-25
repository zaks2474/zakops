# vLLM Tuning Guide

Guide for configuring and tuning vLLM for the ZakOps Agent API deployment.

## Overview

vLLM is used as the inference backend for the local LLM lane, providing
high-throughput, low-latency inference for the agent's language model operations.

## Hardware Requirements

### Minimum Configuration

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| GPU | RTX 3090 (24GB) | A100 (40GB) |
| CPU | 8 cores | 16 cores |
| RAM | 32GB | 64GB |
| Storage | 100GB SSD | 500GB NVMe |

### Memory Estimation

For a 7B parameter model:
- FP16: ~14GB GPU memory
- INT8: ~7GB GPU memory
- INT4: ~3.5GB GPU memory

## Installation

```bash
# Install vLLM
pip install vllm

# With CUDA support (recommended)
pip install vllm[cuda]
```

## Configuration

### Basic Launch

```bash
python -m vllm.entrypoints.openai.api_server \
    --model <model-name> \
    --port 8000 \
    --host 0.0.0.0
```

### Optimized Configuration

```bash
python -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Llama-2-7b-chat-hf \
    --port 8000 \
    --host 0.0.0.0 \
    --tensor-parallel-size 1 \
    --dtype auto \
    --max-model-len 4096 \
    --gpu-memory-utilization 0.9 \
    --swap-space 4 \
    --enforce-eager false
```

### Key Parameters

| Parameter | Description | Default | Tuning Notes |
|-----------|-------------|---------|--------------|
| `--tensor-parallel-size` | GPUs to use | 1 | Increase for larger models |
| `--dtype` | Data type | auto | Use bfloat16 for A100 |
| `--max-model-len` | Max context length | Model default | Lower for memory savings |
| `--gpu-memory-utilization` | GPU memory fraction | 0.9 | Decrease if OOM |
| `--swap-space` | CPU swap (GB) | 4 | Increase for long sequences |
| `--enforce-eager` | Disable CUDA graphs | false | Set true for debugging |

## Performance Tuning

### Batch Processing

vLLM uses continuous batching for optimal throughput:

```bash
# Increase max batch size for throughput
--max-num-seqs 256

# Limit for latency-sensitive applications
--max-num-seqs 32
```

### KV Cache Optimization

```bash
# Block size for KV cache
--block-size 16

# Pre-allocate KV cache blocks
--num-gpu-blocks-override 1000
```

### Quantization

For memory-constrained environments:

```bash
# AWQ quantization
--quantization awq

# GPTQ quantization
--quantization gptq

# SqueezeLLM
--quantization squeezellm
```

## Monitoring

### Metrics Endpoint

vLLM exposes Prometheus metrics at `/metrics`:

```bash
curl http://localhost:8000/metrics
```

Key metrics:
- `vllm:num_requests_running` - Active requests
- `vllm:num_requests_waiting` - Queued requests
- `vllm:gpu_cache_usage_perc` - KV cache utilization
- `vllm:avg_prompt_throughput_toks_per_s` - Input throughput
- `vllm:avg_generation_throughput_toks_per_s` - Output throughput

### Health Check

```bash
curl http://localhost:8000/health
```

## Integration with ZakOps

### Environment Variables

Set in your deployment configuration:

```bash
# vLLM endpoint
VLLM_BASE_URL=http://localhost:8000/v1

# Model name
VLLM_MODEL=meta-llama/Llama-2-7b-chat-hf

# Request timeout
VLLM_TIMEOUT_SECONDS=60

# Max tokens per request
VLLM_MAX_TOKENS=2048
```

### Agent Configuration

Configure the agent to use vLLM:

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url=os.getenv("VLLM_BASE_URL"),
    model=os.getenv("VLLM_MODEL"),
    temperature=0.7,
    max_tokens=2048,
    timeout=60,
)
```

## Benchmarking

### Using record_vllm_benchmark.py

```bash
# Run benchmark
python tools/scripts/record_vllm_benchmark.py \
    --url http://localhost:8000 \
    --prompt "What is the meaning of life?" \
    --num-requests 100 \
    --concurrent 10
```

### Expected Baseline Performance

| Model Size | Tokens/sec (Input) | Tokens/sec (Output) | P95 Latency |
|------------|-------------------|---------------------|-------------|
| 7B FP16 | ~3000 | ~100 | 500ms |
| 13B FP16 | ~2000 | ~80 | 800ms |
| 7B INT4 | ~5000 | ~150 | 300ms |

## Troubleshooting

### Out of Memory (OOM)

1. Lower `--gpu-memory-utilization`
2. Reduce `--max-model-len`
3. Enable quantization
4. Reduce `--max-num-seqs`

### High Latency

1. Check GPU utilization (should be >80%)
2. Verify no thermal throttling
3. Reduce batch size for latency-critical paths
4. Enable speculative decoding if available

### Throughput Issues

1. Increase `--max-num-seqs`
2. Enable continuous batching (default)
3. Use tensor parallelism across GPUs
4. Profile with `--enable-prefix-caching`

## Production Checklist

- [ ] GPU drivers updated
- [ ] CUDA toolkit installed
- [ ] vLLM version pinned
- [ ] Health check endpoint monitored
- [ ] Prometheus metrics scraped
- [ ] Memory limits configured
- [ ] Request timeouts set
- [ ] Rate limiting configured
- [ ] Error handling tested
- [ ] Fallback to cloud LLM configured

## References

- [vLLM Documentation](https://docs.vllm.ai/)
- [vLLM GitHub](https://github.com/vllm-project/vllm)
- [Performance Best Practices](https://docs.vllm.ai/en/latest/performance/best_practices.html)
