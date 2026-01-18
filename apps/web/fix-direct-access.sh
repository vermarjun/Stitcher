#!/bin/bash

# Script to add type assertions to direct response.data property accesses

find src -name "*.tsx" -o -name "*.ts" | while read file; do
  # Skip if file is in node_modules or is the api.ts file itself
  if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"/api.ts" ]] || [[ "$file" == *"/api.types.ts" ]]; then
    continue
  fi
  
  # Add type assertions for direct property access on response.data
  # Pattern: response.data.property -> (response.data as any).property
  sed -i '' 's/response\.data\.\([a-zA-Z_][a-zA-Z0-9_]*\)/(response.data as any).\1/g' "$file"
  sed -i '' 's/assetResponse\.data\.\([a-zA-Z_][a-zA-Z0-9_]*\)/(assetResponse.data as any).\1/g' "$file"
  sed -i '' 's/templateResponse\.data\.\([a-zA-Z_][a-zA-Z0-9_]*\)/(templateResponse.data as any).\1/g' "$file"
  sed -i '' 's/metadataResponse\.data\.\([a-zA-Z_][a-zA-Z0-9_]*\)/(metadataResponse.data as any).\1/g' "$file"
  
  # Fix double casting
  sed -i '' 's/(response\.data as any) as any/(response.data as any)/g' "$file"
  sed -i '' 's/((response\.data as any) as any)/(response.data as any)/g' "$file"
  
done

echo "Added type assertions to direct property accesses"
