#!/bin/bash

# Script to fix response.data access patterns

find src -name "*.tsx" -o -name "*.ts" | while read file; do
  # Skip if file is in node_modules or is the api.ts file itself
  if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"/api.ts" ]] || [[ "$file" == *"/api.types.ts" ]]; then
    continue
  fi
  
  # Pattern 1: if (response.data.success) -> if ((response.data as any).success)
  # Pattern 2: response.data.message -> (response.data as any).message
  # Pattern 3: const data = response.data; -> const data = response.data as any;
  
  # Fix: const data = response.data; -> const data = response.data as any;
  sed -i '' 's/const data = response\.data;/const data = response.data as any;/g' "$file"
  sed -i '' 's/const data = res\.data;/const data = res.data as any;/g' "$file"
  sed -i '' 's/const data = assetResponse\.data;/const data = assetResponse.data as any;/g' "$file"
  sed -i '' 's/const data = templateResponse\.data;/const data = templateResponse.data as any;/g' "$file"
  sed -i '' 's/const data = metadataResponse\.data;/const data = metadataResponse.data as any;/g' "$file"
  
done

echo "Fixed response.data access patterns"
